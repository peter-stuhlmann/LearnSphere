import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import {
  renderBusinessInviteEmail,
  renderWhitelabelInviteEmail,
} from "@/lib/business-invite-email";
import {
  loadWorkspaceMailContext,
  workspaceMailFrom,
} from "@/lib/services/workspace-service";
import { courseWatchPercent } from "@elearning/core/progress";
import {
  businessSeatPriceCents,
  validateSeatCount,
} from "@elearning/core/business";

/**
 * LearnSphere Business: Kurs-Lizenzen mit Seat-Zuweisung per E-Mail.
 * Adressen ohne Konto bleiben "eingeladen" und werden beim ersten Login/
 * Seitenaufruf der Adresse automatisch eingelöst (claimBusinessMemberships).
 */

export type ServiceError =
  | "not_found"
  | "seats_invalid"
  | "seats_full"
  | "email_invalid"
  | "already_member"
  | "course_unavailable"
  | "license_exists";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Business-Einschreibung anlegen (idempotent, zählt nicht als Verkauf). */
async function enrollBusinessMember(userId: string, courseId: string) {
  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (existing) return;
  await db.enrollment.create({
    data: {
      userId,
      courseId,
      pricePaidCents: 0,
      salesChannel: "BUSINESS",
      creatorShareCents: 0,
    },
  });
}

/**
 * Neue Einmal-Bestellung anlegen: nur Business-fähige, veröffentlichte Kurse.
 * Mehrere Bestellungen je Kurs sind erlaubt (Aufstockung).
 */
export async function createLicense(
  ownerId: string,
  input: {
    courseId: string;
    seats: number;
    /** Eingefrorener Seat-Preis; fehlt er, wird er aus Kurspreis + Seat-Zahl
     *  abgeleitet (Kurspreis − Mengenrabatt, mind. Untergrenze). */
    seatPriceCents?: number;
    stripeCustomerId?: string | null;
    stripeCheckoutSessionId?: string | null;
  }
): Promise<{ ok: true; licenseId: string } | { ok: false; error: ServiceError }> {
  if (!validateSeatCount(input.seats)) {
    return { ok: false, error: "seats_invalid" };
  }
  const course = await db.course.findFirst({
    where: { id: input.courseId, published: true, businessEnabled: true },
    select: { id: true, priceCents: true },
  });
  if (!course) return { ok: false, error: "course_unavailable" };

  // Seat-Preis beim Kauf einfrieren: bevorzugt der bereits berechnete Wert
  // (was der Kunde zahlt), sonst aus Kurspreis + Seat-Zahl abgeleitet.
  const seatPriceCents =
    input.seatPriceCents ??
    businessSeatPriceCents(course.priceCents, input.seats);

  // Webhook-Idempotenz: dieselbe Checkout-Session nie doppelt anlegen
  if (input.stripeCheckoutSessionId) {
    const existing = await db.businessLicense.findUnique({
      where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
      select: { id: true },
    });
    if (existing) return { ok: true, licenseId: existing.id };
  }

  const license = await db.businessLicense.create({
    data: {
      ownerId,
      courseId: input.courseId,
      seats: input.seats,
      seatPriceCents,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    },
    select: { id: true },
  });
  return { ok: true, licenseId: license.id };
}

/**
 * Bestellung widerrufen: Status auf CANCELED, Business-Zugänge der Mitglieder
 * entziehen (selbst gekaufte Kurse bleiben unberührt).
 */
export async function cancelLicense(
  ownerId: string,
  licenseId: string
): Promise<{ ok: true } | { ok: false; error: ServiceError }> {
  const license = await db.businessLicense.findFirst({
    where: { id: licenseId, ownerId, status: { not: "CANCELED" } },
    select: {
      id: true,
      courseId: true,
      members: { select: { userId: true } },
    },
  });
  if (!license) return { ok: false, error: "not_found" };

  await db.businessLicense.update({
    where: { id: license.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
  const memberUserIds = license.members
    .map((member) => member.userId)
    .filter((id): id is string => id !== null);
  if (memberUserIds.length > 0) {
    await db.enrollment.deleteMany({
      where: {
        courseId: license.courseId,
        userId: { in: memberUserIds },
        salesChannel: "BUSINESS",
      },
    });
  }
  return { ok: true };
}

/**
 * Mitglied per E-Mail einladen; mit Konto → sofort einschreiben.
 * Optional wird eine Einladungs-Mail mit festem Inhalt verschickt
 * (sonst wird der Seat still angelegt).
 */
export async function addMember(
  ownerId: string,
  licenseId: string,
  emailInput: string,
  options: { notify: boolean; locale: "de" | "en" }
): Promise<{ ok: true } | { ok: false; error: ServiceError }> {
  const email = emailInput.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { ok: false, error: "email_invalid" };
  }

  const license = await db.businessLicense.findFirst({
    where: { id: licenseId, ownerId, status: "ACTIVE" },
    select: {
      id: true,
      courseId: true,
      seats: true,
      course: { select: { title: true } },
      owner: { select: { name: true, storefrontName: true } },
      _count: { select: { members: true } },
    },
  });
  if (!license) return { ok: false, error: "not_found" };
  if (license._count.members >= license.seats) {
    return { ok: false, error: "seats_full" };
  }

  const existing = await db.businessMember.findUnique({
    where: { licenseId_email: { licenseId, email } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "already_member" };

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  await db.businessMember.create({
    data: {
      licenseId,
      email,
      userId: user?.id ?? null,
      enrolledAt: user ? new Date() : null,
    },
  });
  if (user) await enrollBusinessMember(user.id, license.courseId);

  if (options.notify) {
    const loginPath = options.locale === "de" ? "de/anmelden" : "en/login";
    // Whitelabel: Hat der Owner ein Portal, wird markenneutral über die
    // Portal-Adresse eingeladen – kein LearnSphere in Inhalt oder Link.
    const mailCtx = await loadWorkspaceMailContext(ownerId);
    const invite = mailCtx
      ? renderWhitelabelInviteEmail({
          brandName: mailCtx.brandName,
          accentColor: mailCtx.brandColor,
          courseTitle: license.course.title,
          loginUrl: `https://${mailCtx.portalHost}/${loginPath}`,
          locale: options.locale,
        })
      : renderBusinessInviteEmail({
          ownerName:
            license.owner.storefrontName ?? license.owner.name ?? "Dein Team",
          courseTitle: license.course.title,
          loginUrl: `${
            process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
          }/${loginPath}`,
          locale: options.locale,
        });
    // Versandfehler blockieren die Einladung nicht – der Seat steht
    void sendMail({
      to: email,
      subject: invite.subject,
      text: invite.text,
      html: invite.html,
      sender: "noreply",
      from: mailCtx ? (workspaceMailFrom(mailCtx) ?? undefined) : undefined,
    }).catch(() => undefined);
  }
  return { ok: true };
}

/** Seat freigeben: Mitglied entfernen und Business-Zugang entziehen. */
export async function removeMember(
  ownerId: string,
  memberId: string
): Promise<{ ok: true } | { ok: false; error: ServiceError }> {
  const member = await db.businessMember.findFirst({
    where: { id: memberId, license: { ownerId } },
    select: {
      id: true,
      userId: true,
      license: { select: { courseId: true } },
    },
  });
  if (!member) return { ok: false, error: "not_found" };

  await db.businessMember.delete({ where: { id: member.id } });
  if (member.userId) {
    // nur den Business-Zugang entziehen – selbst gekaufte Kurse bleiben
    await db.enrollment.deleteMany({
      where: {
        userId: member.userId,
        courseId: member.license.courseId,
        salesChannel: "BUSINESS",
      },
    });
  }
  return { ok: true };
}

export interface BusinessMemberItem {
  id: string;
  email: string;
  invitedAt: string;
  /** null = eingeladen, aber noch kein Konto/Beitritt */
  enrolledAt: string | null;
  watchPercent: number;
  completed: boolean;
}

export interface BusinessLicenseItem {
  id: string;
  courseId: string;
  courseTitle: string;
  seats: number;
  usedSeats: number;
  status: "ACTIVE" | "PAST_DUE" | "CANCELED";
  canceledAt: string | null;
  /** Eingefrorener Seat-Preis in Cent */
  seatPriceCents: number;
  /** Einmalig gezahlter Gesamtbetrag in Cent (Seats × Seat-Preis) */
  totalPaidCents: number;
  createdAt: string;
  members: BusinessMemberItem[];
}

/** Alle Lizenzen des Inhabers (aktive UND beendete) inkl. Fortschritt. */
export async function listLicenses(
  ownerId: string
): Promise<BusinessLicenseItem[]> {
  const licenses = await db.businessLicense.findMany({
    where: { ownerId },
    // aktive zuerst, dann beendete – jeweils neueste oben
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      course: {
        select: {
          title: true,
          sections: {
            select: {
              lessons: { select: { id: true, durationSeconds: true } },
            },
          },
        },
      },
      members: { orderBy: { invitedAt: "asc" } },
    },
  });

  const results: BusinessLicenseItem[] = [];
  for (const license of licenses) {
    const lessons = license.course.sections.flatMap((s) => s.lessons);
    const memberUserIds = license.members
      .map((m) => m.userId)
      .filter((id): id is string => id !== null);

    // Fortschritt aller Mitglieder in einem Rutsch laden (kein N+1)
    const enrollments = memberUserIds.length
      ? await db.enrollment.findMany({
          where: {
            courseId: license.courseId,
            userId: { in: memberUserIds },
          },
          select: {
            userId: true,
            completedAt: true,
            certificate: { select: { serial: true } },
            lessonProgress: {
              select: { lessonId: true, watchedSeconds: true },
            },
          },
        })
      : [];
    const byUser = new Map(enrollments.map((e) => [e.userId, e]));

    results.push({
      id: license.id,
      courseId: license.courseId,
      courseTitle: license.course.title,
      seats: license.seats,
      usedSeats: license.members.length,
      status: license.status,
      canceledAt: license.canceledAt?.toISOString() ?? null,
      seatPriceCents: license.seatPriceCents,
      totalPaidCents: license.seatPriceCents * license.seats,
      createdAt: license.createdAt.toISOString(),
      members: license.members.map((member) => {
        const enrollment = member.userId ? byUser.get(member.userId) : null;
        const percent = enrollment
          ? courseWatchPercent(
              lessons.map((lesson) => ({
                durationSeconds: lesson.durationSeconds,
                watchedSeconds:
                  enrollment.lessonProgress.find(
                    (p) => p.lessonId === lesson.id
                  )?.watchedSeconds ?? 0,
              }))
            )
          : 0;
        return {
          id: member.id,
          email: member.email,
          invitedAt: member.invitedAt.toISOString(),
          enrolledAt: member.enrolledAt?.toISOString() ?? null,
          watchPercent: Math.round(percent),
          completed: Boolean(
            enrollment?.certificate ?? enrollment?.completedAt
          ),
        };
      }),
    });
  }
  return results;
}

/**
 * Offene Einladungen einer Adresse einlösen: beim ersten Login/Besuch
 * werden userId verknüpft und die Kurs-Einschreibungen angelegt.
 */
export async function claimBusinessMemberships(
  userId: string,
  email: string
): Promise<void> {
  const pending = await db.businessMember.findMany({
    where: { email: email.toLowerCase(), userId: null },
    select: { id: true, license: { select: { courseId: true } } },
  });
  for (const member of pending) {
    await db.businessMember.update({
      where: { id: member.id },
      data: { userId, enrolledAt: new Date() },
    });
    await enrollBusinessMember(userId, member.license.courseId);
  }
}

export interface BusinessCourseOption {
  id: string;
  title: string;
  creatorName: string;
  own: boolean;
  /** Kurspreis in Cent – Basis des Seat-Preises (Preis ÷ 5) */
  priceCents: number;
}

/**
 * Rabattierter Seat-Preis für einen Kurs und die Seat-Anzahl (für den
 * Checkout). Liefert null, wenn der Kurs nicht existiert oder nicht
 * Business-fähig ist.
 */
export async function courseSeatPriceCents(
  courseId: string,
  seats: number
): Promise<number | null> {
  const course = await db.course.findFirst({
    where: { id: courseId, published: true, businessEnabled: true },
    select: { priceCents: true },
  });
  return course ? businessSeatPriceCents(course.priceCents, seats) : null;
}

/**
 * Einzelnen Business-fähigen Kurs per Slug auflösen – für den Direkteinstieg
 * von der Kurs-Detailseite („Auch als Team-Lizenz buchbar“ → Kurs vorausgewählt).
 * Liefert null, wenn der Kurs nicht existiert oder nicht Business-fähig ist.
 */
export async function getBusinessCourseOption(
  ownerId: string,
  slug: string
): Promise<BusinessCourseOption | null> {
  const course = await db.course.findFirst({
    where: { slug, published: true, businessEnabled: true },
    select: {
      id: true,
      title: true,
      priceCents: true,
      creatorId: true,
      creator: { select: { name: true, storefrontName: true } },
    },
  });
  if (!course) return null;
  return {
    id: course.id,
    title: course.title,
    creatorName:
      course.creator.storefrontName ?? course.creator.name ?? "Creator",
    own: course.creatorId === ownerId,
    priceCents: course.priceCents,
  };
}

/** Kurs-Suche für neue Lizenzen: nur Business-fähige Kurse. */
export async function searchBusinessCourses(
  ownerId: string,
  query: string
): Promise<BusinessCourseOption[]> {
  const courses = await db.course.findMany({
    where: {
      published: true,
      businessEnabled: true,
      ...(query ? { title: { contains: query } } : {}),
    },
    orderBy: [{ enrollments: { _count: "desc" } }],
    take: 8,
    select: {
      id: true,
      title: true,
      priceCents: true,
      creatorId: true,
      creator: { select: { name: true, storefrontName: true } },
    },
  });
  return courses.map((course) => ({
    id: course.id,
    title: course.title,
    creatorName:
      course.creator.storefrontName ?? course.creator.name ?? "Creator",
    own: course.creatorId === ownerId,
    priceCents: course.priceCents,
  }));
}
