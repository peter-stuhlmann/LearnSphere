import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import {
  buildUnsubscribeUrl,
  renderCreatorEmail,
  verifyUnsubscribeToken,
} from "@/lib/creator-emails";

/**
 * Creator-Mails an Lernende: Empfänger auflösen, Kampagnen versenden und
 * Abmeldungen verwalten.
 *
 * Datenschutz by design: Diese Schicht ist die EINZIGE, die Empfänger-
 * adressen sieht. Nach außen (Actions/UI) gehen ausschließlich aggregierte
 * Zahlen – Creator können Lernende nicht identifizieren. Jede Mail geht
 * einzeln an genau eine Adresse (kein CC/BCC, kein Leak über Header) und
 * trägt einen individuellen Abmeldelink im Footer.
 */

/** je Durchlauf parallel verschickte Mails – schont das Resend-Rate-Limit */
const SEND_CHUNK = 20;

function unsubscribeSecret(): string {
  return (
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "learnsphere-dev-secret"
  );
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

interface RecipientTarget {
  allCourses: boolean;
  courseIds: string[];
}

interface Recipient {
  email: string;
  /** Titel der Zielkurse, in denen DIESER Empfänger eingeschrieben ist –
   *  macht die Kopfzeile jeder Mail individuell */
  courseTitles: string[];
}

/**
 * Eindeutige Empfänger: eingeschriebene Lernende der (ausgewählten)
 * veröffentlichten Kurse des Creators – ohne den Creator selbst und ohne
 * Adressen, die sich von diesem Creator abgemeldet haben. courseIds
 * fremder Creator fallen still raus (Ownership im Filter).
 */
async function resolveRecipients(
  creatorId: string,
  target: RecipientTarget
): Promise<Recipient[]> {
  const [enrollments, optOuts] = await Promise.all([
    db.enrollment.findMany({
      where: {
        userId: { not: creatorId },
        course: {
          creatorId,
          published: true,
          ...(target.allCourses ? {} : { id: { in: target.courseIds } }),
        },
      },
      select: {
        user: { select: { email: true } },
        course: { select: { title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.creatorEmailOptOut.findMany({
      where: { creatorId },
      select: { email: true },
    }),
  ]);
  const optedOut = new Set(optOuts.map((entry) => entry.email.toLowerCase()));
  const unique = new Map<string, Recipient>();
  for (const enrollment of enrollments) {
    const email = enrollment.user.email;
    if (optedOut.has(email.toLowerCase())) continue;
    const existing = unique.get(email.toLowerCase());
    if (existing) {
      if (!existing.courseTitles.includes(enrollment.course.title)) {
        existing.courseTitles.push(enrollment.course.title);
      }
    } else {
      unique.set(email.toLowerCase(), {
        email,
        courseTitles: [enrollment.course.title],
      });
    }
  }
  return [...unique.values()];
}

/** Nur die Anzahl – mehr bekommt der Creator nie zu sehen. */
export async function countRecipients(
  creatorId: string,
  target: RecipientTarget
): Promise<number> {
  return (await resolveRecipients(creatorId, target)).length;
}

export interface SendCampaignResult {
  ok: true;
  campaignId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
}

export type SendCampaignError = {
  ok: false;
  error: "no_recipients";
};

interface CampaignInput {
  subject: string;
  html: string;
  allCourses: boolean;
  courseIds: string[];
  locale: "de" | "en";
}

/**
 * Empfänger frisch auflösen und ausliefern: je Empfänger rendern
 * (individuell signierter Abmeldelink) und einzeln versenden.
 * Teilfehler werden gezählt statt alles abzubrechen.
 */
async function deliver(
  creatorId: string,
  input: CampaignInput
): Promise<{ recipientCount: number; sentCount: number }> {
  const [recipients, creator, affiliateCode] = await Promise.all([
    resolveRecipients(creatorId, input),
    db.user.findUnique({
      where: { id: creatorId },
      select: { name: true, storefrontName: true },
    }),
    senderAffiliateCode(creatorId),
  ]);
  const creatorName =
    creator?.storefrontName ?? creator?.name ?? "LearnSphere Creator";
  const secret = unsubscribeSecret();
  const baseUrl = appUrl();

  let sent = 0;
  for (let i = 0; i < recipients.length; i += SEND_CHUNK) {
    const chunk = recipients.slice(i, i + SEND_CHUNK);
    const results = await Promise.all(
      chunk.map((recipient) => {
        const { html, text } = renderCreatorEmail({
          subject: input.subject,
          bodyHtml: input.html,
          creatorName,
          courseTitles: recipient.courseTitles,
          locale: input.locale,
          baseUrl,
          affiliateCode,
          unsubscribeUrl: buildUnsubscribeUrl({
            baseUrl,
            locale: input.locale,
            email: recipient.email,
            creatorId,
            secret,
          }),
        });
        return sendMail({
          to: recipient.email,
          subject: input.subject.trim(),
          text,
          html,
          // eigenes Postfach ohne Antwort-Weg (kein replyTo)
          sender: "noreply",
        }).catch(() => false);
      })
    );
    sent += results.filter(Boolean).length;
  }
  return { recipientCount: recipients.length, sentCount: sent };
}

/** Titel-Snapshot der Zielkurse für die Historie (null = alle Kurse). */
async function courseTitleSnapshot(
  creatorId: string,
  input: CampaignInput
): Promise<string[] | null> {
  if (input.allCourses) return null;
  const courses = await db.course.findMany({
    where: { id: { in: input.courseIds }, creatorId },
    select: { title: true },
  });
  return courses.map((course) => course.title);
}

/** Absender ist Partner-Programm-Mitglied? Dann Kurs-Links mit ?aff=CODE. */
async function senderAffiliateCode(creatorId: string): Promise<string | null> {
  const sender = await db.user.findUnique({
    where: { id: creatorId },
    select: { affiliateCode: true, affiliateJoinedAt: true },
  });
  return sender?.affiliateJoinedAt ? (sender.affiliateCode ?? null) : null;
}

/** Zugehörigen Entwurf nach erfolgreichem Versand/Planen entsorgen. */
async function consumeDraft(creatorId: string, draftId?: string) {
  if (!draftId) return;
  await db.creatorCampaign.deleteMany({
    where: { id: draftId, creatorId, status: "DRAFT" },
  });
}

/** Sofort-Versand: ausliefern und als Historie festhalten. */
export async function sendCampaign(
  creatorId: string,
  input: CampaignInput,
  options: { draftId?: string } = {}
): Promise<SendCampaignResult | SendCampaignError> {
  if ((await countRecipients(creatorId, input)) === 0) {
    return { ok: false, error: "no_recipients" };
  }
  const { recipientCount, sentCount } = await deliver(creatorId, input);
  if (recipientCount === 0) return { ok: false, error: "no_recipients" };
  await consumeDraft(creatorId, options.draftId);

  const campaign = await db.creatorCampaign.create({
    data: {
      creatorId,
      subject: input.subject.trim(),
      contentHtml: input.html,
      status: "SENT",
      sentAt: new Date(),
      allCourses: input.allCourses,
      courseIds: input.allCourses ? undefined : input.courseIds,
      locale: input.locale,
      courseTitles:
        (await courseTitleSnapshot(creatorId, input)) ?? undefined,
      recipientCount,
      sentCount,
      failedCount: recipientCount - sentCount,
    },
    select: { id: true },
  });

  return {
    ok: true,
    campaignId: campaign.id,
    recipientCount,
    sentCount,
    failedCount: recipientCount - sentCount,
  };
}

/**
 * Geplanter Versand: Kampagne mit Zielzeitpunkt ablegen – versendet wird
 * durch processDueCampaigns (Cron), die Empfänger werden erst dann
 * aufgelöst.
 */
export async function scheduleCampaign(
  creatorId: string,
  input: CampaignInput,
  scheduledAt: Date,
  options: { draftId?: string } = {}
): Promise<SendCampaignResult | SendCampaignError> {
  // früher Hinweis statt böser Überraschung zum Versandzeitpunkt
  if ((await countRecipients(creatorId, input)) === 0) {
    return { ok: false, error: "no_recipients" };
  }
  await consumeDraft(creatorId, options.draftId);
  const campaign = await db.creatorCampaign.create({
    data: {
      creatorId,
      subject: input.subject.trim(),
      contentHtml: input.html,
      status: "SCHEDULED",
      scheduledAt,
      allCourses: input.allCourses,
      courseIds: input.allCourses ? undefined : input.courseIds,
      locale: input.locale,
      courseTitles:
        (await courseTitleSnapshot(creatorId, input)) ?? undefined,
    },
    select: { id: true },
  });
  return {
    ok: true,
    campaignId: campaign.id,
    recipientCount: 0,
    sentCount: 0,
    failedCount: 0,
  };
}

/**
 * Entwurf speichern (neu oder aktualisieren). Entwürfe dürfen unvollständig
 * sein – validiert wird erst beim Senden/Planen.
 */
export async function saveDraft(
  creatorId: string,
  input: CampaignInput & { draftId?: string }
): Promise<{ draftId: string }> {
  const courseTitles = await courseTitleSnapshot(creatorId, input);
  const data = {
    subject: input.subject.trim().slice(0, 160),
    contentHtml: input.html,
    allCourses: input.allCourses,
    courseIds: input.allCourses ? undefined : input.courseIds,
    locale: input.locale,
    courseTitles: courseTitles ?? undefined,
  };

  if (input.draftId) {
    const updated = await db.creatorCampaign.updateMany({
      where: { id: input.draftId, creatorId, status: "DRAFT" },
      data,
    });
    if (updated.count > 0) return { draftId: input.draftId };
  }
  const created = await db.creatorCampaign.create({
    data: { ...data, creatorId, status: "DRAFT" },
    select: { id: true },
  });
  return { draftId: created.id };
}

export interface DraftDetails {
  subject: string;
  html: string;
  allCourses: boolean;
  courseIds: string[];
}

/** Entwurf zum Weiterbearbeiten laden (nur eigene). */
export async function loadDraft(
  creatorId: string,
  draftId: string
): Promise<DraftDetails | null> {
  const draft = await db.creatorCampaign.findFirst({
    where: { id: draftId, creatorId, status: "DRAFT" },
    select: {
      subject: true,
      contentHtml: true,
      allCourses: true,
      courseIds: true,
    },
  });
  if (!draft) return null;
  return {
    subject: draft.subject,
    html: draft.contentHtml,
    allCourses: draft.allCourses,
    courseIds: Array.isArray(draft.courseIds)
      ? (draft.courseIds as string[])
      : [],
  };
}

/** Entwurf löschen (nur eigene, nur Entwürfe). */
export async function deleteDraft(
  creatorId: string,
  draftId: string
): Promise<boolean> {
  const result = await db.creatorCampaign.deleteMany({
    where: { id: draftId, creatorId, status: "DRAFT" },
  });
  return result.count > 0;
}

/** Geplante Kampagne stornieren (nur eigene, nur solange nicht versendet). */
export async function cancelScheduledCampaign(
  creatorId: string,
  campaignId: string
): Promise<boolean> {
  const result = await db.creatorCampaign.updateMany({
    where: { id: campaignId, creatorId, status: "SCHEDULED" },
    data: { status: "CANCELED" },
  });
  return result.count > 0;
}

/**
 * Fällige geplante Kampagnen versenden (Cron/Trigger). Jede Kampagne wird
 * per Status-Claim (SCHEDULED → SENDING) übernommen – läuft der Prozessor
 * parallel, versendet trotzdem nur einer.
 */
export async function processDueCampaigns(
  now: Date = new Date()
): Promise<{ processed: number }> {
  const due = await db.creatorCampaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: {
      id: true,
      creatorId: true,
      subject: true,
      contentHtml: true,
      allCourses: true,
      courseIds: true,
      locale: true,
    },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });

  let processed = 0;
  for (const campaign of due) {
    const claim = await db.creatorCampaign.updateMany({
      where: { id: campaign.id, status: "SCHEDULED" },
      data: { status: "SENDING" },
    });
    if (claim.count === 0) continue; // ein paralleler Lauf war schneller

    try {
      const { recipientCount, sentCount } = await deliver(
        campaign.creatorId,
        {
          subject: campaign.subject,
          html: campaign.contentHtml,
          allCourses: campaign.allCourses,
          courseIds: Array.isArray(campaign.courseIds)
            ? (campaign.courseIds as string[])
            : [],
          locale: campaign.locale === "en" ? "en" : "de",
        }
      );
      await db.creatorCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "SENT",
          sentAt: now,
          recipientCount,
          sentCount,
          failedCount: recipientCount - sentCount,
        },
      });
      processed += 1;
    } catch (err) {
      // zurück auf SCHEDULED: der nächste Lauf versucht es erneut
      console.error("[creator-email] Geplanter Versand fehlgeschlagen:", err);
      await db.creatorCampaign.updateMany({
        where: { id: campaign.id, status: "SENDING" },
        data: { status: "SCHEDULED" },
      });
    }
  }
  return { processed };
}

/**
 * Abmeldung aus dem Mail-Link (ohne Login): Token prüfen und Opt-Out
 * speichern. Idempotent – mehrfaches Klicken bleibt eine Abmeldung.
 */
export async function unsubscribeByToken(input: {
  encodedEmail: string;
  creatorId: string;
  token: string;
}): Promise<{ ok: true; creatorName: string } | { ok: false }> {
  let email: string;
  try {
    email = Buffer.from(input.encodedEmail, "base64url").toString("utf8");
  } catch {
    return { ok: false };
  }
  if (
    !email ||
    !input.creatorId ||
    !verifyUnsubscribeToken(
      email,
      input.creatorId,
      input.token,
      unsubscribeSecret()
    )
  ) {
    return { ok: false };
  }

  const creator = await db.user.findUnique({
    where: { id: input.creatorId },
    select: { name: true, storefrontName: true },
  });
  if (!creator) return { ok: false };

  await db.creatorEmailOptOut.upsert({
    where: { email_creatorId: { email, creatorId: input.creatorId } },
    update: {},
    create: { email, creatorId: input.creatorId },
  });

  return {
    ok: true,
    creatorName: creator.storefrontName ?? creator.name ?? "Creator",
  };
}

export interface CampaignListItem {
  id: string;
  subject: string;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELED";
  scheduledAt: string | null;
  /** null = alle Kurse */
  courseTitles: string[] | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface CampaignListFilters {
  status?: "DRAFT" | "SCHEDULED" | "SENT" | "CANCELED" | null;
  /** Zeitraum über createdAt (bzw. Suchbegriff auch im Mail-Inhalt) */
  from?: Date | null;
  toExclusive?: Date | null;
  query?: string | null;
}

/**
 * Kampagnen-Liste des Creators (ohne jegliche Empfängerdaten):
 * Entwürfe, Geplante, Gesendete und Stornierte – filterbar nach Status,
 * Zeitraum und Suchbegriff (Betreff UND Mail-Inhalt).
 */
export async function listCampaigns(
  creatorId: string,
  filters: CampaignListFilters = {}
): Promise<CampaignListItem[]> {
  const query = filters.query?.trim();
  const rows = await db.creatorCampaign.findMany({
    where: {
      creatorId,
      // SENDING zählt in der Anzeige zu den Gesendeten
      ...(filters.status === "SENT"
        ? { status: { in: ["SENT", "SENDING"] } }
        : filters.status
          ? { status: filters.status }
          : {}),
      ...(filters.from || filters.toExclusive
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.toExclusive ? { lt: filters.toExclusive } : {}),
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { subject: { contains: query } },
              { contentHtml: { contains: query } },
            ],
          }
        : {}),
    },
    // Entwürfe und Geplante zuerst, dann der Rest nach Datum
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    status: row.status,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    courseTitles: Array.isArray(row.courseTitles)
      ? (row.courseTitles as string[])
      : null,
    recipientCount: row.recipientCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    createdAt: row.createdAt.toISOString(),
  }));
}
