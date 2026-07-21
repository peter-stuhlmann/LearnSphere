import type { IapStore } from "@prisma/client";
import { priceCentsToTier } from "@elearning/core/iap-tiers";
import { iapCreatorShareCents, storeFeeCents } from "@elearning/core/revenue";
import { refundDeadline } from "@elearning/core/refund";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";

/**
 * In-App-Käufe: Intent → Store-Kauf → serverseitige Verifikation →
 * idempotentes Fulfillment (modelliert nach lib/fulfillment.ts).
 * Coupons/Affiliate bleiben bewusst Web-only (Store-Preise sind fix).
 */

export type IntentResult =
  | {
      ok: true;
      intentId: string;
      appAccountToken: string;
      productId: string;
      tierCents: number;
    }
  | {
      ok: false;
      error: "not_found" | "already_enrolled" | "not_available";
    };

export async function createPurchaseIntent(
  userId: string,
  courseId: string
): Promise<IntentResult> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, published: true, priceCents: true },
  });
  if (!course || !course.published) return { ok: false, error: "not_found" };

  const enrolled = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (enrolled) return { ok: false, error: "already_enrolled" };

  // Gratis-Kurse laufen über enroll; Preise über der höchsten Stufe nur im Web
  const tier = priceCentsToTier(course.priceCents);
  if (!tier) return { ok: false, error: "not_available" };

  const intent = await db.iapPurchaseIntent.create({
    data: {
      userId,
      courseId,
      productId: tier.productId,
      tierCents: tier.tierCents,
    },
  });

  return {
    ok: true,
    intentId: intent.id,
    appAccountToken: intent.appAccountToken,
    productId: intent.productId,
    tierCents: intent.tierCents,
  };
}

export type FulfillResult =
  | { ok: true; courseId: string }
  | {
      ok: false;
      error:
        | "intent_not_found"
        | "intent_mismatch"
        | "already_processed_elsewhere";
    };

/**
 * Verifizierten Store-Kauf einlösen: Transaktion + Einschreibung anlegen.
 * Idempotent über storeTransactionId; appAccountToken bindet den Kauf an
 * den Intent (verhindert Cross-Grade-Betrug).
 */
export async function fulfillVerifiedPurchase(input: {
  userId: string;
  intentId: string;
  store: IapStore;
  storeTransactionId: string;
  /** vom Store gemeldete Kontobindung – muss zum Intent passen */
  accountToken: string | null;
  productId: string;
  currency?: string | null;
}): Promise<FulfillResult> {
  const intent = await db.iapPurchaseIntent.findUnique({
    where: { id: input.intentId },
  });
  if (!intent || intent.userId !== input.userId) {
    return { ok: false, error: "intent_not_found" };
  }
  if (
    intent.productId !== input.productId ||
    (input.accountToken !== null &&
      input.accountToken !== intent.appAccountToken)
  ) {
    return { ok: false, error: "intent_mismatch" };
  }

  // Replay: dieselbe Store-Transaktion darf nur einmal einlösen
  const existing = await db.iapTransaction.findUnique({
    where: { storeTransactionId: input.storeTransactionId },
    select: { userId: true, courseId: true },
  });
  if (existing) {
    return existing.userId === input.userId
      ? { ok: true, courseId: existing.courseId }
      : { ok: false, error: "already_processed_elsewhere" };
  }

  const commission = getEnv().IAP_STORE_COMMISSION_PERCENT;
  const gross = intent.tierCents;

  const courseId = await db.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.upsert({
      where: {
        userId_courseId: { userId: intent.userId, courseId: intent.courseId },
      },
      update: {},
      create: {
        userId: intent.userId,
        courseId: intent.courseId,
        pricePaidCents: gross,
        salesChannel: "PLATFORM",
        creatorShareCents: iapCreatorShareCents(gross, commission),
        // Prüfungs-Sperre läuft auch für Store-Käufe; die ERSTATTUNG selbst
        // geht bei IAP über Apple/Google (refund-actions verweigert Stripe-Weg)
        refundableUntil: refundDeadline(new Date()),
      },
    });
    await tx.iapTransaction.create({
      data: {
        store: input.store,
        storeTransactionId: input.storeTransactionId,
        productId: intent.productId,
        userId: intent.userId,
        courseId: intent.courseId,
        enrollmentId: enrollment.id,
        grossCents: gross,
        currency: input.currency ?? "EUR",
        storeFeeCents: storeFeeCents(gross, commission),
        creatorShareCents: iapCreatorShareCents(gross, commission),
      },
    });
    await tx.iapPurchaseIntent.update({
      where: { id: intent.id },
      data: { consumedAt: new Date() },
    });
    return intent.courseId;
  });

  return { ok: true, courseId };
}

/**
 * Refund/Revoke aus Store-Webhooks: Transaktion widerrufen und die
 * Einschreibung entfernen (Fortschritt/Zertifikat kaskadieren mit).
 * Bereits ausgezahlte Creator-Anteile: manuelle Reconciliation (Payout-Doku).
 */
export async function handleStoreRefund(
  storeTransactionId: string
): Promise<void> {
  const transaction = await db.iapTransaction.findUnique({
    where: { storeTransactionId },
  });
  if (!transaction || transaction.status === "REVOKED") return;

  await db.$transaction(async (tx) => {
    await tx.iapTransaction.update({
      where: { id: transaction.id },
      data: { status: "REVOKED", refundedAt: new Date() },
    });
    if (transaction.enrollmentId) {
      await tx.enrollment
        .delete({ where: { id: transaction.enrollmentId } })
        .catch(() => undefined);
    }
  });
}
