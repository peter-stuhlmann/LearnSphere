"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { applyCoupon, normalizeCouponCode, validateCoupon } from "@elearning/core/coupon";
import { creatorShareCents, type SalesChannelName } from "@elearning/core/revenue";
import { refundDeadline } from "@elearning/core/refund";

/** Kleinunternehmerregelung: Pflichthinweis auf jeder Rechnung (§ 19 UStG). */
const INVOICE_FOOTER =
  "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).";
import {
  availableCreditCents,
  resolveAffiliateForPurchase,
} from "@/lib/affiliate-server";
import { API_PLAN, isStripeEnabled, stripe } from "@/lib/stripe";
import type { ActionResult } from "./auth-actions";

type CheckoutResult = ActionResult & { url?: string; demo?: boolean };

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Startet den Stripe-Checkout für einen Kurskauf. Ohne konfigurierte
 * Stripe-Keys meldet die Action `demo: true` – der Client nutzt dann den
 * bisherigen Demo-Checkout (lokale Entwicklung).
 *
 * `via` bestimmt den Verkaufskanal: kommt der Kauf über das Embed-Widget
 * oder die API ("EXTERNAL"), erhält der Creator 75 %, sonst 50 %.
 */
export async function startCourseCheckout(input: {
  courseId: string;
  couponCode?: string;
  locale: string;
  via?: string;
}): Promise<CheckoutResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const course = await db.course.findUnique({
    where: { id: input.courseId },
  });
  if (!course || !course.published) return { ok: false, error: "not_found" };

  const existing = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session.user.id, courseId: course.id },
    },
  });
  if (existing) return { ok: true, url: undefined, demo: false };

  // Gutschein serverseitig anwenden – der Client bestimmt den Preis nie selbst
  let finalPriceCents = course.priceCents;
  let couponCode: string | undefined;
  if (input.couponCode) {
    const code = normalizeCouponCode(input.couponCode);
    const coupon = await db.coupon.findFirst({
      where: { code, courses: { some: { courseId: course.id } } },
    });
    if (!coupon) return { ok: false, error: "coupon_invalid" };
    const validation = validateCoupon(coupon, new Date());
    if (!validation.ok) return { ok: false, error: validation.error };
    finalPriceCents = applyCoupon(course.priceCents, coupon);
    couponCode = code;
  }

  if (!isStripeEnabled() || finalPriceCents === 0) {
    // Produktions-Guard: ohne Stripe-Keys keine Bezahlkurse im Demo-Modus
    if (
      finalPriceCents > 0 &&
      process.env.NODE_ENV === "production"
    ) {
      return { ok: false, error: "payments_unavailable" };
    }
    return { ok: true, demo: true };
  }

  const channel: SalesChannelName =
    input.via === "embed" || input.via === "api" ? "EXTERNAL" : "PLATFORM";
  const locale = input.locale === "en" ? "en" : "de";

  // Affiliate-Attribution serverseitig aus dem Cookie auflösen
  const attribution = await resolveAffiliateForPurchase({
    buyerUserId: session.user.id,
    creatorUserId: course.creatorId,
    priceCents: finalPriceCents,
  });

  // Bewusst KEINE Stripe-Connect-Direktzahlung: Alle Zahlungen laufen über
  // die Plattform, Creator-Anteile landen im Auszahlungs-Guthaben und werden
  // erst nach der 30-Tage-Sperrfrist verfügbar (EARNINGS_HOLD_DAYS).
  const creditUsedCents = Math.min(
    await availableCreditCents(session.user.id),
    finalPriceCents
  );
  const chargeCents = finalPriceCents - creditUsedCents;

  // Komplett mit Guthaben bezahlt → direkt einschreiben, kein Stripe nötig
  if (chargeCents === 0) {
    await db.$transaction(async (tx) => {
      await tx.enrollment.create({
        data: {
          userId: session.user.id,
          courseId: course.id,
          pricePaidCents: finalPriceCents,
          couponCode: couponCode ?? null,
          salesChannel: channel,
          creatorShareCents: creatorShareCents(finalPriceCents, channel),
          affiliateUserId: attribution.affiliateUserId,
          affiliateShareCents: attribution.affiliateShareCents,
          creditUsedCents,
          refundableUntil: refundDeadline(new Date()),
        },
      });
      if (couponCode) {
        await tx.coupon.updateMany({
          where: { code: couponCode, courses: { some: { courseId: course.id } } },
          data: { redeemedCount: { increment: 1 } },
        });
      }
    });
    return { ok: true, demo: false };
  }

  const checkout = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      // Beleg-Pflicht (B2C): Stripe stellt automatisch eine Rechnung aus
      // und mailt sie dem Käufer
      invoice_creation: {
        enabled: true,
        invoice_data: { footer: INVOICE_FOOTER },
      },
      customer_email: session.user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: course.currency.toLowerCase(),
            unit_amount: chargeCents,
            product_data: {
              name: course.title,
              description: course.subtitle ?? undefined,
            },
          },
        },
      ],
      metadata: {
        kind: "course",
        userId: session.user.id,
        courseId: course.id,
        couponCode: couponCode ?? "",
        channel,
        // voller Verkaufspreis (Anteile) + eingesetztes Guthaben + Affiliate;
        // wird im Fulfillment erneut serverseitig validiert
        salePrice: String(finalPriceCents),
        creditUsed: String(creditUsedCents),
        affiliate: attribution.affiliateUserId ?? "",
      },
      success_url: `${appUrl()}/${locale}/courses/${course.slug}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/${locale}/courses/${course.slug}`,
    }
  );

  return { ok: true, url: checkout.url ?? undefined };
}

/**
 * Warenkorb-Checkout: mehrere Kurse in EINER Stripe-Sitzung. Läuft immer
 * über die Plattform (kein Stripe Connect – verschiedene Creator lassen
 * sich nicht in einer Direct-Charge-Sitzung mischen); die Umsätze werden
 * pro Kurs über creatorShareCents dem jeweiligen Creator zugeordnet.
 * Gutscheine/Guthaben bleiben dem Einzelkauf vorbehalten.
 */
export async function startCartCheckout(input: {
  courseIds: string[];
  locale: string;
}): Promise<CheckoutResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const ids = [...new Set(input.courseIds)].slice(0, 20);
  if (ids.length === 0) return { ok: false, error: "cart_empty" };

  const [courses, enrollments] = await Promise.all([
    db.course.findMany({
      where: { id: { in: ids }, published: true, priceCents: { gt: 0 } },
      select: {
        id: true,
        title: true,
        subtitle: true,
        priceCents: true,
        currency: true,
        creatorId: true,
      },
    }),
    db.enrollment.findMany({
      where: { userId, courseId: { in: ids } },
      select: { courseId: true },
    }),
  ]);
  const enrolled = new Set(enrollments.map((e) => e.courseId));
  const toBuy = courses.filter((course) => !enrolled.has(course.id));
  if (toBuy.length === 0) return { ok: false, error: "cart_empty" };

  // Affiliate-Attribution je Kurs (Cookie ist hier verfügbar, im Webhook nicht)
  const attributions = await Promise.all(
    toBuy.map((course) =>
      resolveAffiliateForPurchase({
        buyerUserId: userId,
        creatorUserId: course.creatorId,
        priceCents: course.priceCents,
      })
    )
  );

  if (!isStripeEnabled()) {
    // Produktions-Guard: ohne Stripe-Keys keine stillen Gratis-Freischaltungen
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "payments_unavailable" };
    }
    // Demo-Modus (Dev): alle Kurse direkt freischalten
    await db.$transaction(
      toBuy.map((course, index) =>
        db.enrollment.create({
          data: {
            userId,
            courseId: course.id,
            pricePaidCents: course.priceCents,
            salesChannel: "PLATFORM",
            creatorShareCents: creatorShareCents(course.priceCents, "PLATFORM"),
            affiliateUserId: attributions[index].affiliateUserId,
            affiliateShareCents: attributions[index].affiliateShareCents,
            refundableUntil: refundDeadline(new Date()),
          },
        })
      )
    );
    return { ok: true, demo: true };
  }

  const locale = input.locale === "en" ? "en" : "de";
  const checkout = await stripe().checkout.sessions.create({
    mode: "payment",
    // Beleg-Pflicht (B2C): automatische Rechnung je Kauf
    invoice_creation: {
      enabled: true,
      invoice_data: { footer: INVOICE_FOOTER },
    },
    customer_email: session.user.email ?? undefined,
    line_items: toBuy.map((course) => ({
      quantity: 1,
      price_data: {
        currency: course.currency.toLowerCase(),
        unit_amount: course.priceCents,
        product_data: {
          name: course.title,
          description: course.subtitle ?? undefined,
        },
      },
    })),
    metadata: {
      kind: "cart",
      userId,
      courseIds: toBuy.map((course) => course.id).join(","),
      // gleiche Reihenfolge wie courseIds; im Fulfillment erneut validiert
      affiliates: attributions
        .map((attribution) => attribution.affiliateUserId ?? "")
        .join(","),
    },
    success_url: `${appUrl()}/${locale}/${locale === "de" ? "warenkorb" : "cart"}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/${locale}/${locale === "de" ? "warenkorb" : "cart"}`,
  });

  return { ok: true, url: checkout.url ?? undefined };
}

/**
 * Startet den Abo-Checkout für den API-Zugriff (25 €/Monat, 240 €/Jahr).
 * Ohne Stripe-Keys wird das Abo im Demo-Modus direkt aktiviert.
 */
export async function startApiPlanCheckout(input: {
  interval: "MONTH" | "YEAR";
  locale: string;
}): Promise<CheckoutResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const existing = await db.apiSubscription.findUnique({
    where: { userId: session.user.id },
  });
  if (existing && existing.status !== "CANCELED") {
    return { ok: true, demo: false };
  }

  if (!isStripeEnabled()) {
    // Produktions-Guard: kein Gratis-Abo bei fehlender Zahlungskonfiguration
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "payments_unavailable" };
    }
    // Lokale Entwicklung: Abo direkt aktivieren
    await db.apiSubscription.upsert({
      where: { userId: session.user.id },
      update: { status: "ACTIVE", interval: input.interval },
      create: {
        userId: session.user.id,
        status: "ACTIVE",
        interval: input.interval,
      },
    });
    return { ok: true, demo: true };
  }

  const plan = API_PLAN[input.interval];
  const locale = input.locale === "en" ? "en" : "de";
  const checkout = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: existing?.stripeCustomerId ?? undefined,
    customer_email: existing?.stripeCustomerId
      ? undefined
      : (session.user.email ?? undefined),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: plan.amountCents,
          recurring: { interval: plan.interval },
          product_data: { name: API_PLAN.name },
        },
      },
    ],
    metadata: {
      kind: "api_subscription",
      userId: session.user.id,
      interval: input.interval,
    },
    success_url: `${appUrl()}/${locale}/creator/distribution?api=1`,
    cancel_url: `${appUrl()}/${locale}/creator/distribution`,
  });

  return { ok: true, url: checkout.url ?? undefined };
}

/** Stripe-Billing-Portal für das API-Abo (Rechnungen, Kündigung). */
export async function openApiBillingPortal(input: {
  locale: string;
}): Promise<CheckoutResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!isStripeEnabled()) return { ok: false, error: "stripe_disabled" };

  const subscription = await db.apiSubscription.findUnique({
    where: { userId: session.user.id },
  });
  if (!subscription?.stripeCustomerId) {
    return { ok: false, error: "no_customer" };
  }

  const locale = input.locale === "en" ? "en" : "de";
  const portal = await stripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl()}/${locale}/creator/distribution`,
  });

  return { ok: true, url: portal.url };
}
