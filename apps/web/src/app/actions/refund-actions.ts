"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isStripeEnabled, stripe } from "@/lib/stripe";
import {
  isGuaranteeActive,
  normalizeRefundReason,
} from "@elearning/core/refund";
import type { ActionResult } from "./auth-actions";

/**
 * 30-Tage-Rückgabegarantie: Kurs zurückgeben (ohne Angabe von Gründen –
 * der Grund ist eine freiwillige Angabe). Ablauf:
 * 1. Garantie prüfen (Frist, kein Verzicht, bezahlter Kauf)
 * 2. Geld zurück: Stripe-Refund über die gespeicherte Checkout-Session;
 *    Guthaben-Anteile werden durch das Löschen der Einschreibung
 *    automatisch wieder frei. IAP-Käufe erstattet nur Apple/Google.
 * 3. Einschreibung löschen (Zugriff, Fortschritt, Zertifikat, Anteile weg)
 *    + Refund-Beleg für die Creator-Finanzen schreiben.
 */
export async function refundEnrollment(input: {
  courseId: string;
  reason?: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session.user.id, courseId: input.courseId },
    },
    include: {
      course: {
        select: { id: true, title: true, currency: true, creatorId: true },
      },
    },
  });
  if (!enrollment) return { ok: false, error: "not_found" };

  if (!isGuaranteeActive(enrollment)) {
    return { ok: false, error: "guarantee_expired" };
  }

  // Store-Käufe (Apple/Google) können wir nicht erstatten – das läuft
  // ausschließlich über die Rückerstattung des jeweiligen Stores
  const iap = await db.iapTransaction.findFirst({
    where: { userId: session.user.id, courseId: input.courseId },
    select: { id: true },
  });
  if (iap) {
    return { ok: false, error: "refund_via_store" };
  }

  // Geld zurück über Stripe (falls der Kauf über Stripe lief). Schlägt die
  // Erstattung fehl, bleibt die Einschreibung unangetastet.
  if (enrollment.stripeSessionId && isStripeEnabled()) {
    try {
      const checkout = await stripe().checkout.sessions.retrieve(
        enrollment.stripeSessionId
      );
      const paymentIntent =
        typeof checkout.payment_intent === "string"
          ? checkout.payment_intent
          : checkout.payment_intent?.id;
      if (paymentIntent) {
        await stripe().refunds.create({ payment_intent: paymentIntent });
      }
    } catch (error) {
      console.error("[refund] Stripe-Erstattung fehlgeschlagen:", error);
      return { ok: false, error: "refund_failed" };
    }
  }

  await db.$transaction([
    db.refund.create({
      data: {
        courseId: enrollment.course.id,
        creatorId: enrollment.course.creatorId,
        courseTitle: enrollment.course.title,
        amountCents: enrollment.pricePaidCents,
        currency: enrollment.course.currency,
        creatorShareCents: enrollment.creatorShareCents,
        reason: normalizeRefundReason(input.reason),
      },
    }),
    // Zugriff, Fortschritt, Zertifikat und Anteile erlöschen sofort
    db.enrollment.delete({ where: { id: enrollment.id } }),
  ]);

  revalidatePath("/[locale]/my-learning", "page");
  return { ok: true };
}

/**
 * Rückgabegarantie freiwillig vorzeitig beenden – schaltet die
 * Abschlussprüfung sofort frei, das Rückgaberecht erlischt endgültig.
 */
export async function waiveRefundGuarantee(input: {
  courseId: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session.user.id, courseId: input.courseId },
    },
    select: {
      id: true,
      refundableUntil: true,
      guaranteeWaivedAt: true,
    },
  });
  if (!enrollment) return { ok: false, error: "not_found" };
  // idempotent: ohne aktive Garantie gibt es nichts zu beenden
  if (!isGuaranteeActive(enrollment)) return { ok: true };

  await db.enrollment.update({
    where: { id: enrollment.id },
    data: { guaranteeWaivedAt: new Date() },
  });

  return { ok: true };
}
