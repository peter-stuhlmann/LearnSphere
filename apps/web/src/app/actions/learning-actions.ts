"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import * as progressService from "@/lib/services/progress-service";
import { submitQuizForUser } from "@/lib/services/quiz-service";
import { applyCoupon, normalizeCouponCode, validateCoupon } from "@elearning/core/coupon";
import {
  availableCreditCents,
  resolveAffiliateForPurchase,
} from "@/lib/affiliate-server";
import { creatorShareCents, type SalesChannelName } from "@elearning/core/revenue";
import { refundDeadline } from "@elearning/core/refund";
import { isStripeEnabled } from "@/lib/stripe";
import type { ActionResult } from "./auth-actions";

export async function checkCoupon(input: {
  courseId: string;
  code: string;
}): Promise<ActionResult & { finalPriceCents?: number; code?: string }> {
  const course = await db.course.findUnique({
    where: { id: input.courseId },
  });
  if (!course || !course.published) return { ok: false, error: "not_found" };

  const code = normalizeCouponCode(input.code);
  const coupon = await db.coupon.findFirst({
    where: { code, courses: { some: { courseId: input.courseId } } },
  });
  if (!coupon) return { ok: false, error: "coupon_invalid" };

  const validation = validateCoupon(coupon, new Date());
  if (!validation.ok) return { ok: false, error: validation.error };

  return {
    ok: true,
    code,
    finalPriceCents: applyCoupon(course.priceCents, coupon),
  };
}

export async function enroll(
  courseId: string,
  options?: { couponCode?: string; via?: string }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || !course.published) return { ok: false, error: "not_found" };

  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });
  if (existing) return { ok: true };

  // Produktions-Guard: Ohne konfigurierte Stripe-Keys dürfen Bezahlkurse
  // NIEMALS still im Demo-Modus freigeschaltet werden
  if (
    course.priceCents > 0 &&
    !isStripeEnabled() &&
    process.env.NODE_ENV === "production"
  ) {
    return { ok: false, error: "payments_unavailable" };
  }

  // Mit konfiguriertem Stripe laufen Bezahlkurse ausschließlich über den
  // Checkout (startCourseCheckout) – außer der Gutschein macht sie kostenlos.
  if (isStripeEnabled() && course.priceCents > 0) {
    let finalPrice = course.priceCents;
    if (options?.couponCode) {
      const code = normalizeCouponCode(options.couponCode);
      const coupon = await db.coupon.findFirst({
        where: { code, courses: { some: { courseId } } },
      });
      if (coupon && validateCoupon(coupon, new Date()).ok) {
        finalPrice = applyCoupon(course.priceCents, coupon);
      }
    }
    if (finalPrice > 0) {
      return { ok: false, error: "payment_required" };
    }
  }

  const channel: SalesChannelName =
    options?.via === "embed" || options?.via === "api"
      ? "EXTERNAL"
      : "PLATFORM";

  /** Affiliate-Provision + Guthaben-Einsatz für einen Kaufpreis ermitteln. */
  async function purchaseExtras(paidCents: number) {
    if (paidCents <= 0) {
      return { affiliateUserId: null, affiliateShareCents: 0, creditUsedCents: 0 };
    }
    const [attribution, credit] = await Promise.all([
      resolveAffiliateForPurchase({
        buyerUserId: session!.user.id,
        creatorUserId: course!.creatorId,
        priceCents: paidCents,
      }),
      availableCreditCents(session!.user.id),
    ]);
    return {
      affiliateUserId: attribution.affiliateUserId,
      affiliateShareCents: attribution.affiliateShareCents,
      // Guthaben deckt den Kauf (teilweise) – der Rest wäre zu zahlen
      creditUsedCents: Math.min(credit, paidCents),
    };
  }

  // Demo-Checkout: kostenpflichtige Kurse werden ohne Zahlungsanbieter
  // "gekauft" – der gezahlte Preis wird als Beleg gespeichert.
  if (options?.couponCode && course.priceCents > 0) {
    const code = normalizeCouponCode(options.couponCode);
    // Transaktion: Gutschein prüfen, einlösen und einschreiben in einem Schritt,
    // damit maxRedemptions auch bei parallelen Käufen hält.
    const result = await db.$transaction(async (tx) => {
      const coupon = await tx.coupon.findFirst({
        where: { code, courses: { some: { courseId } } },
      });
      if (!coupon) return { error: "coupon_invalid" as const };
      const validation = validateCoupon(coupon, new Date());
      if (!validation.ok) return { error: validation.error };

      await tx.coupon.update({
        where: { id: coupon.id },
        data: { redeemedCount: { increment: 1 } },
      });
      const paid = applyCoupon(course.priceCents, coupon);
      const extras = await purchaseExtras(paid);
      await tx.enrollment.create({
        data: {
          userId: session.user.id,
          courseId,
          pricePaidCents: paid,
          couponCode: code,
          salesChannel: channel,
          creatorShareCents: creatorShareCents(paid, channel),
          // Rückgabegarantie nur für bezahlte Käufe
          refundableUntil: paid > 0 ? refundDeadline(new Date()) : null,
          ...extras,
        },
      });
      return { error: null };
    });
    if (result.error) return { ok: false, error: result.error };
    revalidatePath(`/[locale]/courses/${course.slug}`, "page");
    return { ok: true };
  }

  const extras = await purchaseExtras(course.priceCents);
  await db.enrollment.create({
    data: {
      userId: session.user.id,
      courseId,
      pricePaidCents: course.priceCents,
      salesChannel: channel,
      creatorShareCents: creatorShareCents(course.priceCents, channel),
      // Rückgabegarantie nur für bezahlte Käufe
      refundableUntil:
        course.priceCents > 0 ? refundDeadline(new Date()) : null,
      ...extras,
    },
  });

  revalidatePath(`/[locale]/courses/${course.slug}`, "page");
  return { ok: true };
}

/**
 * Letzte Position merken: die zuletzt geöffnete Lektion landet an der
 * Einschreibung – beim nächsten Öffnen des Kurses geht es dort weiter.
 */
export async function markLessonVisited(
  lessonId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return progressService.markLessonVisited(session.user.id, lessonId);
}

export async function updateLessonProgress(input: {
  lessonId: string;
  watchedSeconds: number;
  forceComplete?: boolean;
  /** letzte Abspielposition je Medienblock (neuer Stand gewinnt) */
  positions?: Record<string, number>;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return progressService.updateLessonProgress(session.user.id, input);
}

export interface QuizSubmissionResult extends ActionResult {
  scorePercent?: number;
  passed?: boolean;
  certificateSerial?: string;
  nextAttemptAt?: string;
  /** Detailergebnis je Frage – für die Auswertung nach der Abgabe */
  perQuestion?: { questionId: string; correct: boolean; points: number }[];
  earnedPoints?: number;
  totalPoints?: number;
}

export async function submitQuiz(input: {
  quizId: string;
  answers: Record<string, string[]>;
}): Promise<QuizSubmissionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return submitQuizForUser(session.user.id, input);
}

/**
 * "Erledigt" wieder abwählen: Fortschritt der Lektion zurücksetzen, z. B.
 * um sie erneut durchzuarbeiten. Setzt auch watchedSeconds zurück – sonst
 * würde der nächste Fortschritts-Save die Lektion sofort wieder abhaken.
 */
export async function resetLessonProgress(
  lessonId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return progressService.resetLessonProgress(session.user.id, lessonId);
}
