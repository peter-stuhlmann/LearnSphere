import type Stripe from "stripe";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { buildEmail } from "@/lib/email-template";
import {
  affiliateShareCents,
  creatorShareCents,
  type SalesChannelName,
} from "@elearning/core/revenue";
import { canEarnCommission } from "@elearning/core/affiliate";
import { refundDeadline } from "@elearning/core/refund";
import { availableCreditCents } from "@/lib/affiliate-server";

/** Schaltet das API-Abo nach erfolgreichem Checkout frei (idempotent). */
export async function fulfillApiSubscriptionCheckout(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const interval = session.metadata?.interval === "YEAR" ? "YEAR" : "MONTH";
  if (!userId) return;

  await db.apiSubscription.upsert({
    where: { userId },
    update: {
      status: "ACTIVE",
      interval,
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : null,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : null,
    },
    create: {
      userId,
      status: "ACTIVE",
      interval,
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : null,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : null,
    },
  });
}

/** Spiegelt Statusänderungen des Stripe-Abos (Kündigung, Zahlungsausfall). */
export async function syncApiSubscription(
  subscription: Stripe.Subscription
): Promise<void> {
  const record = await db.apiSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!record) return;

  const status =
    subscription.status === "canceled" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete_expired"
      ? "CANCELED"
      : subscription.status === "past_due"
        ? "PAST_DUE"
        : "ACTIVE";

  await db.apiSubscription.update({
    where: { id: record.id },
    data: { status },
  });
}

/**
 * Schaltet alle Kurse eines Warenkorb-Checkouts frei (idempotent je Kurs).
 * Anteile werden PRO KURS auf dessen Verkaufspreis gerechnet und damit dem
 * jeweiligen Creator zugeordnet; Affiliates werden je Kurs erneut validiert.
 */
export async function fulfillCartCheckout(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const courseIds = (session.metadata?.courseIds ?? "")
    .split(",")
    .filter(Boolean);
  const affiliates = (session.metadata?.affiliates ?? "").split(",");
  if (!userId || courseIds.length === 0) return;
  if (session.payment_status !== "paid") return;

  const courses = await db.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, priceCents: true, creatorId: true },
  });
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const existing = await db.enrollment.findMany({
    where: { userId, courseId: { in: courseIds } },
    select: { courseId: true },
  });
  const enrolled = new Set(existing.map((e) => e.courseId));

  for (const [index, courseId] of courseIds.entries()) {
    const course = courseById.get(courseId);
    if (!course || enrolled.has(courseId)) continue;

    // Affiliate je Kurs erneut serverseitig prüfen
    let affiliateUserId: string | null = null;
    let affiliateShare = 0;
    const candidate = affiliates[index] || null;
    if (candidate) {
      const affiliate = await db.user.findUnique({
        where: { id: candidate },
        select: { id: true, affiliateJoinedAt: true },
      });
      if (
        affiliate?.affiliateJoinedAt &&
        canEarnCommission({
          affiliateUserId: affiliate.id,
          buyerUserId: userId,
          creatorUserId: course.creatorId,
          priceCents: course.priceCents,
        })
      ) {
        affiliateUserId = affiliate.id;
        affiliateShare = affiliateShareCents(course.priceCents);
      }
    }

    await db.enrollment.create({
      data: {
        userId,
        courseId,
        pricePaidCents: course.priceCents,
        salesChannel: "PLATFORM",
        creatorShareCents: creatorShareCents(course.priceCents, "PLATFORM"),
        affiliateUserId,
        affiliateShareCents: affiliateShare,
        // 30-Tage-Rückgabegarantie (bezahlter Kauf)
        refundableUntil: refundDeadline(new Date()),
        stripeSessionId: session.id,
      },
    });
  }
}

/**
 * Transparenz-Mail nach automatischer Konto-Anlage (DSGVO): Die Person
 * erfährt, dass und warum ein Konto existiert, und wie sie es übernimmt
 * (Passwort setzen) oder loswird. Mail-Fehler brechen nichts ab.
 */
async function sendAccountCreatedMail(
  email: string,
  locale: string
): Promise<void> {
  try {
    const t = await getTranslations({ locale, namespace: "mail.apiAccount" });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetPath =
      locale === "en" ? "forgot-password" : "passwort-vergessen";
    const mail = buildEmail({
      locale,
      preview: t("preview"),
      heading: t("heading"),
      paragraphs: [t("intro"), t("why")],
      button: { label: t("button"), url: `${appUrl}/${locale}/${resetPath}` },
      note: t("note"),
    });
    await sendMail({
      to: email,
      subject: t("subject"),
      text: mail.text,
      html: mail.html,
    });
  } catch (error) {
    console.error("[api-checkout] Konto-Info-Mail fehlgeschlagen:", error);
  }
}

/**
 * Findet das Konto zur Käufer-E-Mail eines API-Checkouts oder legt es an.
 * Neu angelegte Konten haben kein Passwort – der Login läuft dann über
 * „Passwort vergessen" oder OAuth mit derselben Adresse. Bei der Anlage
 * geht eine Transparenz-Mail an die Adresse.
 */
export async function findOrCreateBuyer(
  email: string,
  locale: string
): Promise<string> {
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return existing.id;

  const normalizedLocale = locale === "en" ? "en" : "de";
  const user = await db.user.create({
    data: {
      email,
      // Anzeigename aus dem Local-Part – die Person kann ihn später ändern
      name: email.split("@")[0] || email,
      locale: normalizedLocale,
    },
  });
  await sendAccountCreatedMail(email, normalizedLocale);
  return user.id;
}

/**
 * Schaltet einen Kurskauf über die Creator-API frei (Headless-Checkout).
 * Anders als beim Plattform-Checkout gibt es zum Kaufzeitpunkt evtl. noch
 * kein Konto – es wird anhand der E-Mail gefunden oder angelegt.
 * Idempotent über die Einschreibung.
 */
export async function fulfillApiCourseCheckout(
  session: Stripe.Checkout.Session
): Promise<void> {
  const courseId = session.metadata?.courseId;
  const email = (
    session.metadata?.email ??
    session.customer_details?.email ??
    ""
  ).toLowerCase();
  if (!courseId || !email) return;
  if (session.payment_status !== "paid") return;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, priceCents: true },
  });
  if (!course) return;

  const salePrice = Number(session.metadata?.salePrice) || course.priceCents;
  const userId = await findOrCreateBuyer(
    email,
    session.metadata?.locale ?? "de"
  );

  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return;

  const couponCode = session.metadata?.couponCode || null;
  await db.$transaction(async (tx) => {
    await tx.enrollment.create({
      data: {
        userId,
        courseId,
        pricePaidCents: salePrice,
        couponCode,
        // Verkauf über die eigene Seite des Creators → 75-%-Anteil
        salesChannel: "EXTERNAL",
        creatorShareCents: creatorShareCents(salePrice, "EXTERNAL"),
        // 30-Tage-Rückgabegarantie (bezahlter Kauf)
        refundableUntil: refundDeadline(new Date()),
        stripeSessionId: session.id,
      },
    });
    if (couponCode) {
      await tx.coupon.updateMany({
        where: { code: couponCode, courses: { some: { courseId } } },
        data: { redeemedCount: { increment: 1 } },
      });
    }
  });
}

/**
 * Kehrt ein Checkout-Fulfillment um (volle Erstattung oder Chargeback):
 * Die Einschreibung wird entfernt – damit erlöschen Kurszugang, Zertifikat
 * (DB-Cascade) und die Creator-/Affiliate-Anteile, die aus der Enrollment-
 * Zeile berechnet werden; eingesetztes Guthaben wird wieder frei.
 * Idempotent: deleteMany ohne Treffer ist ein No-Op.
 */
export async function revokeCheckoutEnrollments(
  session: Stripe.Checkout.Session
): Promise<void> {
  // API-Checkout: kein userId in den Metadaten (Konto entsteht erst beim
  // Fulfillment) – die Einschreibung hängt an der Session-ID
  if (session.metadata?.kind === "api_course") {
    await db.enrollment.deleteMany({
      where: { stripeSessionId: session.id },
    });
    return;
  }

  const userId = session.metadata?.userId;
  if (!userId) return;

  if (session.metadata?.kind === "course" && session.metadata.courseId) {
    await db.enrollment.deleteMany({
      where: { userId, courseId: session.metadata.courseId },
    });
    return;
  }
  if (session.metadata?.kind === "cart") {
    const courseIds = (session.metadata.courseIds ?? "")
      .split(",")
      .filter(Boolean);
    if (courseIds.length > 0) {
      await db.enrollment.deleteMany({
        where: { userId, courseId: { in: courseIds } },
      });
    }
  }
}

/**
 * Schaltet einen bezahlten Kurs frei. Wird sowohl vom Webhook als auch
 * von der Erfolgsseiten-Verifikation aufgerufen – deshalb idempotent:
 * Existiert die Einschreibung schon, passiert nichts weiter.
 */
export async function fulfillCourseCheckout(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const courseId = session.metadata?.courseId;
  const couponCode = session.metadata?.couponCode || null;
  const channel: SalesChannelName =
    session.metadata?.channel === "EXTERNAL" ? "EXTERNAL" : "PLATFORM";
  if (!userId || !courseId) return;
  if (session.payment_status !== "paid") return;

  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return;

  // Voller Verkaufspreis: Anteile rechnen auf dem Verkaufspreis, nicht auf
  // dem (um eingesetztes Guthaben reduzierten) Zahlbetrag.
  const charged = session.amount_total ?? 0;
  const salePrice = Number(session.metadata?.salePrice) || charged;
  // Guthaben-Einsatz erneut deckeln – schützt vor Doppel-Einsatz über
  // parallel geöffnete Checkouts.
  const plannedCredit = Math.max(0, Number(session.metadata?.creditUsed) || 0);
  const creditUsedCents = Math.min(
    plannedCredit,
    await availableCreditCents(userId)
  );

  // Affiliate erneut serverseitig validieren (Mitgliedschaft + Regeln)
  let affiliateUserId: string | null = null;
  let affiliateShare = 0;
  const affiliateFromMeta = session.metadata?.affiliate || null;
  if (affiliateFromMeta) {
    const [affiliate, course] = await Promise.all([
      db.user.findUnique({
        where: { id: affiliateFromMeta },
        select: { id: true, affiliateJoinedAt: true },
      }),
      db.course.findUnique({
        where: { id: courseId },
        select: { creatorId: true },
      }),
    ]);
    if (
      affiliate?.affiliateJoinedAt &&
      course &&
      canEarnCommission({
        affiliateUserId: affiliate.id,
        buyerUserId: userId,
        creatorUserId: course.creatorId,
        priceCents: salePrice,
      })
    ) {
      affiliateUserId = affiliate.id;
      affiliateShare = affiliateShareCents(salePrice);
    }
  }

  await db.$transaction(async (tx) => {
    await tx.enrollment.create({
      data: {
        userId,
        courseId,
        pricePaidCents: salePrice,
        couponCode,
        salesChannel: channel,
        creatorShareCents: creatorShareCents(salePrice, channel),
        // Bei Direct Charges hat Stripe den Creator schon bezahlt –
        // diese Verkäufe zählen nicht ins auszahlbare Guthaben.
        paidViaConnect: session.metadata?.connect === "1",
        affiliateUserId,
        affiliateShareCents: affiliateShare,
        creditUsedCents,
        // 30-Tage-Rückgabegarantie (bezahlter Kauf)
        refundableUntil: refundDeadline(new Date()),
        stripeSessionId: session.id,
      },
    });
    if (couponCode) {
      await tx.coupon.updateMany({
        where: { code: couponCode, courses: { some: { courseId } } },
        data: { redeemedCount: { increment: 1 } },
      });
    }
  });
}
