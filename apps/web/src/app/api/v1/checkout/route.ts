import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  API_CHECKOUT_BUDGET,
  authenticateApiRequest,
  retryAfterHeaders,
} from "@/lib/api-auth";
import {
  TtlCache,
  apiCheckoutSchema,
  withSessionPlaceholder,
} from "@/lib/api-checkout";
import { findOrCreateBuyer } from "@/lib/fulfillment";
import { isStripeEnabled, stripe } from "@/lib/stripe";
import { creatorShareCents } from "@elearning/core/revenue";
import { refundDeadline } from "@elearning/core/refund";
import { applyCoupon, validateCoupon } from "@elearning/core/coupon";

/** Kleinunternehmerregelung: Pflichthinweis auf jeder Rechnung (§ 19 UStG). */
const INVOICE_FOOTER =
  "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).";

/** JSON-Body-Obergrenze – die Nutzlast ist winzig, alles darüber ist Unfug. */
const MAX_BODY_BYTES = 10_000;

/**
 * Idempotenz: identische Checkout-Anfragen liefern 30 Minuten lang dieselbe
 * Stripe-URL statt neuer Sessions (ein Prozess = ein Cache, wie der
 * Rate-Limiter dieser Instanz).
 */
const sessionCache = new TtlCache<string>(30 * 60 * 1000);

/*
 * Bewusst KEIN CORS/OPTIONS: Dieser Endpoint gehört auf den Server des
 * Integrators – der API-Key darf nie in Browser-Code stehen. Browser-Aufrufe
 * scheitern damit an der Same-Origin-Policy statt zum Key-Leck einzuladen.
 */

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: retryAfterHeaders(status),
  });
}

/**
 * POST /api/v1/checkout – Headless-Checkout für die eigene Seite des
 * Creators: liefert eine Stripe-Checkout-URL für einen eigenen Kurs.
 * Der Kauf wird per Stripe-Webhook erfüllt; das Käuferkonto entsteht
 * dabei automatisch anhand der E-Mail (Verkaufskanal EXTERNAL, 75 %).
 */
export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  const authResult = await authenticateApiRequest(request, API_CHECKOUT_BUDGET);
  if (!authResult.ok) {
    return json({ error: authResult.error }, authResult.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = apiCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "invalid_input",
        detail: parsed.error.issues[0]?.message ?? "invalid",
      },
      400
    );
  }
  const input = parsed.data;

  const course = await db.course.findUnique({
    where: { slug: input.course },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      priceCents: true,
      currency: true,
      published: true,
      creatorId: true,
    },
  });
  if (!course || !course.published || course.creatorId !== authResult.userId) {
    return json({ error: "not_found" }, 404);
  }

  // Bereits eingeschrieben? Dann gibt es nichts zu bezahlen.
  const buyer = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (buyer) {
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: { userId: buyer.id, courseId: course.id },
      },
      select: { id: true },
    });
    if (enrollment) {
      return json({ data: { alreadyEnrolled: true } });
    }
  }

  // Gutschein serverseitig anwenden – der Client bestimmt den Preis nie selbst
  let finalPriceCents = course.priceCents;
  let couponCode: string | undefined;
  if (input.couponCode && course.priceCents > 0) {
    const coupon = await db.coupon.findFirst({
      where: {
        code: input.couponCode,
        courses: { some: { courseId: course.id } },
      },
    });
    if (!coupon) return json({ error: "coupon_invalid" }, 400);
    const validation = validateCoupon(coupon, new Date());
    if (!validation.ok) return json({ error: validation.error }, 400);
    finalPriceCents = applyCoupon(course.priceCents, coupon);
    couponCode = input.couponCode;
  }

  /** Gratis (auch per Gutschein) und Demo-Modus: direkt einschreiben. */
  async function enrollDirectly(demo: boolean) {
    const userId = await findOrCreateBuyer(input.email, input.locale);
    await db.$transaction(async (tx) => {
      await tx.enrollment.create({
        data: {
          userId,
          courseId: course!.id,
          pricePaidCents: finalPriceCents,
          couponCode: couponCode ?? null,
          salesChannel: "EXTERNAL",
          creatorShareCents: creatorShareCents(finalPriceCents, "EXTERNAL"),
          // Rückgabegarantie nur bei bezahltem Kauf
          refundableUntil:
            finalPriceCents > 0 ? refundDeadline(new Date()) : null,
        },
      });
      if (couponCode) {
        await tx.coupon.updateMany({
          where: {
            code: couponCode,
            courses: { some: { courseId: course!.id } },
          },
          data: { redeemedCount: { increment: 1 } },
        });
      }
    });
    return json({ data: { enrolled: true, ...(demo ? { demo: true } : {}) } });
  }

  if (finalPriceCents === 0) {
    return enrollDirectly(false);
  }

  if (!isStripeEnabled()) {
    // Produktions-Guard: ohne Stripe-Keys keine stillen Gratis-Freischaltungen
    if (process.env.NODE_ENV === "production") {
      return json({ error: "payments_unavailable" }, 503);
    }
    return enrollDirectly(true);
  }

  // Idempotenz: gleiche Anfrage innerhalb von 30 min → gleiche Session-URL
  const cacheKey = [
    authResult.keyId,
    course.id,
    input.email,
    couponCode ?? "",
  ].join(":");
  const cachedUrl = sessionCache.get(cacheKey);
  if (cachedUrl) {
    return json({ data: { url: cachedUrl } });
  }

  const checkout = await stripe().checkout.sessions.create({
    mode: "payment",
    // Beleg-Pflicht (B2C): Stripe stellt automatisch eine Rechnung aus
    invoice_creation: {
      enabled: true,
      invoice_data: { footer: INVOICE_FOOTER },
    },
    customer_email: input.email,
    locale: input.locale,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: course.currency.toLowerCase(),
          unit_amount: finalPriceCents,
          product_data: {
            name: course.title,
            description: course.subtitle ?? undefined,
          },
        },
      },
    ],
    metadata: {
      kind: "api_course",
      courseId: course.id,
      email: input.email,
      locale: input.locale,
      couponCode: couponCode ?? "",
      // wird im Fulfillment erneut gegen den Kurs validiert
      salePrice: String(finalPriceCents),
    },
    success_url: withSessionPlaceholder(input.successUrl),
    cancel_url: input.cancelUrl,
  });

  if (checkout.url) {
    sessionCache.set(cacheKey, checkout.url);
  }
  return json({ data: { url: checkout.url } });
}
