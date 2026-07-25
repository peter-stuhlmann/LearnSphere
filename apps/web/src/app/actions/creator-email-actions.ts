"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeEmailRichText } from "@/lib/sanitize";
import {
  validateCreatorCampaign,
  validateScheduleAt,
} from "@/lib/creator-emails";
import * as service from "@/lib/services/creator-email-service";
import type { CampaignListItem } from "@/lib/services/creator-email-service";
import type { ActionResult } from "./auth-actions";

/**
 * Creator-Mails an Lernende. Empfängeradressen verlassen NIE den Server –
 * die Actions liefern ausschließlich Zahlen und Historie ohne Personenbezug.
 */

interface CampaignTarget {
  allCourses: boolean;
  courseIds: string[];
}

function sanitizeTarget(input: CampaignTarget): CampaignTarget {
  return {
    allCourses: input.allCourses === true,
    courseIds: Array.isArray(input.courseIds)
      ? input.courseIds
          .filter((id): id is string => typeof id === "string")
          .slice(0, 100)
      : [],
  };
}

/** Live-Zähler für die Compose-UI ("erreicht 132 Lernende"). */
export async function countCreatorEmailRecipients(
  input: CampaignTarget
): Promise<ActionResult & { count?: number }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const count = await service.countRecipients(
    session.user.id,
    sanitizeTarget(input)
  );
  return { ok: true, count };
}

export interface SendCreatorEmailResult extends ActionResult {
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  /** true = Kampagne wurde für später eingeplant statt versendet */
  scheduled?: boolean;
}

export async function sendCreatorEmail(input: {
  subject: string;
  html: string;
  allCourses: boolean;
  courseIds: string[];
  locale: string;
  /** ISO-Zeitpunkt für geplanten Versand; null/fehlend = sofort */
  scheduledAt?: string | null;
  /** Entwurf, aus dem gesendet wird – wird nach Erfolg entsorgt */
  draftId?: string | null;
}): Promise<SendCreatorEmailResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const target = sanitizeTarget(input);
  const subject = typeof input.subject === "string" ? input.subject : "";
  const html = typeof input.html === "string" ? input.html : "";

  const validation = validateCreatorCampaign({ subject, html, ...target });
  if (!validation.ok) return { ok: false, error: validation.error };

  const schedule = validateScheduleAt(
    typeof input.scheduledAt === "string" ? input.scheduledAt : null,
    new Date()
  );
  if (!schedule.ok) return { ok: false, error: schedule.error };

  // Missbrauchsbremse: 5 Kampagnen pro Stunde und Creator (inkl. geplanter)
  if (
    !(await checkRateLimit(`creator-email:${session.user.id}`, {
      limit: 5,
      windowMs: 60 * 60_000,
    }))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const campaign = {
    subject,
    // Sanitisierung passiert zusätzlich beim Rendern – hier für die Historie
    html: sanitizeEmailRichText(html),
    ...target,
    locale: input.locale === "en" ? ("en" as const) : ("de" as const),
  };

  const draftId =
    typeof input.draftId === "string" ? input.draftId : undefined;
  const result = schedule.date
    ? await service.scheduleCampaign(session.user.id, campaign, schedule.date, {
        draftId,
      })
    : await service.sendCampaign(session.user.id, campaign, { draftId });
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    scheduled: schedule.date !== null,
    recipientCount: result.recipientCount,
    sentCount: result.sentCount,
    failedCount: result.failedCount,
  };
}

/** Geplante Kampagne stornieren (nur eigene, solange nicht versendet). */
export async function cancelCreatorCampaign(input: {
  campaignId: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const canceled = await service.cancelScheduledCampaign(
    session.user.id,
    typeof input.campaignId === "string" ? input.campaignId : ""
  );
  return canceled ? { ok: true } : { ok: false, error: "not_found" };
}

export interface EmailBlockCourse {
  slug: string;
  title: string;
  coverImage: string | null;
  priceCents: number;
  currency: string;
  /** eigener Kurs → kein Affiliate-Link in der Mail */
  own: boolean;
  creatorName: string;
}

/**
 * Autocomplete für den Kurs-Card-Block: ALLE veröffentlichten Shop-Kurse.
 * Eigene Kurse werden markiert – fremde bekommen beim Versand automatisch
 * den Affiliate-Link des Absenders (sofern Partner-Programm-Mitglied).
 */
export async function searchCreatorCourses(input: {
  query: string;
}): Promise<ActionResult & { courses?: EmailBlockCourse[] }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const query =
    typeof input.query === "string" ? input.query.trim().slice(0, 100) : "";
  const courses = await db.course.findMany({
    where: {
      published: true,
      listedInShop: true,
      ...(query ? { title: { contains: query } } : {}),
    },
    // eigene Kurse zuerst, dann die beliebtesten
    orderBy: [{ enrollments: { _count: "desc" } }],
    take: 8,
    select: {
      slug: true,
      title: true,
      coverImage: true,
      priceCents: true,
      currency: true,
      creatorId: true,
      creator: { select: { name: true, storefrontName: true } },
    },
  });
  return {
    ok: true,
    courses: courses
      .sort(
        (a, b) =>
          Number(b.creatorId === session.user.id) -
          Number(a.creatorId === session.user.id)
      )
      .map((course) => ({
        slug: course.slug,
        title: course.title,
        coverImage: course.coverImage,
        priceCents: course.priceCents,
        currency: course.currency,
        own: course.creatorId === session.user.id,
        creatorName:
          course.creator.storefrontName ?? course.creator.name ?? "Creator",
      })),
  };
}

/** Entwurf speichern – unvollständige Inhalte sind hier ausdrücklich okay. */
export async function saveCreatorDraft(input: {
  draftId?: string | null;
  subject: string;
  html: string;
  allCourses: boolean;
  courseIds: string[];
  locale: string;
}): Promise<ActionResult & { draftId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const target = sanitizeTarget(input);
  const subject = typeof input.subject === "string" ? input.subject : "";
  const html = typeof input.html === "string" ? input.html : "";
  if (subject.trim().length === 0 && html.trim().length === 0) {
    return { ok: false, error: "draft_empty" };
  }
  if (html.length > 100_000) return { ok: false, error: "content_too_long" };

  const result = await service.saveDraft(session.user.id, {
    draftId: typeof input.draftId === "string" ? input.draftId : undefined,
    subject,
    html: sanitizeEmailRichText(html),
    ...target,
    locale: input.locale === "en" ? "en" : "de",
  });
  return { ok: true, draftId: result.draftId };
}

/** Entwurf zum Weiterbearbeiten laden. */
export async function loadCreatorDraft(input: {
  draftId: string;
}): Promise<ActionResult & { draft?: service.DraftDetails }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const draft = await service.loadDraft(
    session.user.id,
    typeof input.draftId === "string" ? input.draftId : ""
  );
  return draft ? { ok: true, draft } : { ok: false, error: "not_found" };
}

/** Entwurf löschen. */
export async function deleteCreatorDraft(input: {
  draftId: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const deleted = await service.deleteDraft(
    session.user.id,
    typeof input.draftId === "string" ? input.draftId : ""
  );
  return deleted ? { ok: true } : { ok: false, error: "not_found" };
}

const LIST_STATUSES = ["DRAFT", "SCHEDULED", "SENT", "CANCELED"] as const;

/**
 * Kampagnen-Liste (nur eigene, keine Empfängerdaten) – filterbar nach
 * Status, Zeitraum und Suchbegriff (Betreff + Mail-Inhalt).
 */
export async function listCreatorCampaigns(
  input: {
    status?: string | null;
    /** ISO-Tage (einschließlich) */
    from?: string | null;
    to?: string | null;
    query?: string | null;
  } = {}
): Promise<ActionResult & { campaigns?: CampaignListItem[] }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const status = LIST_STATUSES.includes(
    input.status as (typeof LIST_STATUSES)[number]
  )
    ? (input.status as (typeof LIST_STATUSES)[number])
    : null;
  const from = input.from ? new Date(`${input.from}T00:00:00`) : null;
  const toExclusive = input.to
    ? new Date(new Date(`${input.to}T00:00:00`).getTime() + 86_400_000)
    : null;

  return {
    ok: true,
    campaigns: await service.listCampaigns(session.user.id, {
      status,
      from: from && !Number.isNaN(from.getTime()) ? from : null,
      toExclusive:
        toExclusive && !Number.isNaN(toExclusive.getTime())
          ? toExclusive
          : null,
      query:
        typeof input.query === "string" ? input.query.slice(0, 100) : null,
    }),
  };
}
