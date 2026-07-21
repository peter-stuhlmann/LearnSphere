"use server";

import type { Prisma } from "@prisma/client";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { TERMINE_REVOKE_URL } from "@/lib/termine-connect";
import { isStripeEnabled, stripe } from "@/lib/stripe";
import {
  ANONYMIZED_CREATOR_NAME,
  anonymizedEmail,
  retentionPurgeDate,
} from "@/lib/retention";
import type { ActionResult } from "./auth-actions";

/**
 * Konto löschen (Art. 17 DSGVO) – zweistufig:
 *
 * 1. OHNE fremde Einschreibungen in eigene Kurse → echte Volllöschung
 *    (DB-Cascade räumt alles ab).
 * 2. MIT fremden Einschreibungen (Creator mit Verkäufen) → ANONYMISIERUNG:
 *    alle personenbezogenen Daten werden gelöscht/geschreddert, die Kurse
 *    werden depubliziert – aber zahlende Lernende behalten Zugriff,
 *    Fortschritt und Zertifikate.
 *
 * In beiden Fällen wandern buchführungsrelevante Belege (bezahlte eigene
 * Käufe, Auszahlungen) zweckgebunden ins SalesArchive
 * (§ 147 AO / § 257 HGB, Art. 17 Abs. 3 lit. b DSGVO).
 */

/** Gibt es fremde Einschreibungen in Kurse dieses Creators? */
export async function hasForeignEnrollments(userId: string): Promise<boolean> {
  const count = await db.enrollment.count({
    where: { course: { creatorId: userId }, userId: { not: userId } },
  });
  return count > 0;
}

/**
 * termine.lol-Verbindung des Kontos trennen: den API-Key drüben widerrufen
 * (best effort) und lokal löschen. Kurse behalten ihre "Termine anbieten"-
 * Checkbox, bieten ohne Verbindung aber nichts mehr an.
 */
export async function disconnectTermine(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { bookingApiKey: true },
  });
  if (!user) return { ok: false, error: "unauthorized" };

  const env = getEnv();
  if (
    user.bookingApiKey &&
    env.TERMINE_CLIENT_ID &&
    env.TERMINE_CLIENT_SECRET
  ) {
    // Best effort: ein Fehler drüben darf das Trennen nie blockieren
    try {
      await fetch(TERMINE_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: env.TERMINE_CLIENT_ID,
          clientSecret: env.TERMINE_CLIENT_SECRET,
          apiKey: user.bookingApiKey,
        }),
      });
    } catch {
      // Offline/Fehler bei termine.lol – lokal trennen wir trotzdem
    }
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { bookingCalendarId: null, bookingApiKey: null },
  });
  return { ok: true };
}

/** Bezahlte Käufe + Auszahlungen des Nutzers als Belege archivieren. */
async function archiveFinancialRecords(
  tx: Prisma.TransactionClient,
  user: { id: string; name: string | null; email: string }
): Promise<void> {
  const partyName = user.name ?? "—";

  const paidEnrollments = await tx.enrollment.findMany({
    where: { userId: user.id, pricePaidCents: { gt: 0 } },
    select: {
      pricePaidCents: true,
      creditUsedCents: true,
      couponCode: true,
      salesChannel: true,
      creatorShareCents: true,
      affiliateShareCents: true,
      createdAt: true,
      course: { select: { title: true, currency: true } },
    },
  });
  if (paidEnrollments.length > 0) {
    await tx.salesArchive.createMany({
      data: paidEnrollments.map((enrollment) => ({
        kind: "BUYER_ENROLLMENT",
        occurredAt: enrollment.createdAt,
        purgeAfter: retentionPurgeDate(enrollment.createdAt),
        amountCents: enrollment.pricePaidCents,
        currency: enrollment.course.currency,
        description: `Kurskauf: ${enrollment.course.title}`,
        partyName,
        partyEmail: user.email,
        details: {
          creditUsedCents: enrollment.creditUsedCents,
          couponCode: enrollment.couponCode,
          salesChannel: enrollment.salesChannel,
          creatorShareCents: enrollment.creatorShareCents,
          affiliateShareCents: enrollment.affiliateShareCents,
        },
      })),
    });
  }

  const payouts = await tx.payout.findMany({
    where: { userId: user.id },
    select: {
      amountCents: true,
      status: true,
      holder: true,
      createdAt: true,
      paidAt: true,
    },
  });
  if (payouts.length > 0) {
    await tx.salesArchive.createMany({
      data: payouts.map((payout) => ({
        kind: "CREATOR_PAYOUT",
        occurredAt: payout.paidAt ?? payout.createdAt,
        purgeAfter: retentionPurgeDate(payout.paidAt ?? payout.createdAt),
        amountCents: payout.amountCents,
        description: "Creator-Auszahlung",
        // Kontoinhaber laut Auszahlungsbeleg (ohne IBAN – die steht auf
        // dem Bankbeleg der Plattform)
        partyName: payout.holder,
        partyEmail: user.email,
        details: { status: payout.status },
      })),
    });
  }
}

/** Personenbezogene Daten schreddern, Kurse depublizieren – Zugänge bleiben. */
async function anonymizeUser(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: {
      name: ANONYMIZED_CREATOR_NAME,
      email: anonymizedEmail(userId),
      emailVerified: null,
      image: null,
      passwordHash: null,
      totpSecret: null,
      totpEnabled: false,
      totpLastUsedStep: null,
      handle: null,
      storefrontName: null,
      brandColor: null,
      customDomain: null,
      stripeAccountId: null,
      stripeChargesEnabled: false,
      payoutHolder: null,
      payoutIban: null,
      creatorBio: null,
      affiliateCode: null,
      affiliateJoinedAt: null,
      bookingCalendarId: null,
      bookingApiKey: null,
    },
  });

  // Login-/Gerätezugänge und persönliche Artefakte endgültig entfernen
  await tx.account.deleteMany({ where: { userId } });
  await tx.session.deleteMany({ where: { userId } });
  await tx.mobileSession.deleteMany({ where: { userId } });
  await tx.passwordResetToken.deleteMany({ where: { userId } });
  await tx.emailVerifyToken.deleteMany({ where: { userId } });
  await tx.apiKey.deleteMany({ where: { userId } });
  await tx.billingAddress.deleteMany({ where: { userId } });
  await tx.assistantMessage.deleteMany({ where: { userId } });
  await tx.lessonNote.deleteMany({ where: { userId } });
  await tx.apiSubscription.deleteMany({ where: { userId } });
  await tx.payout.deleteMany({ where: { userId } });
  // eigene Einschreibungen (als Käufer anderer Kurse) inkl. Fortschritt
  await tx.enrollment.deleteMany({ where: { userId } });
  // KI-Protokoll vom Konto lösen (bleibt als anonyme Verbrauchsstatistik)
  await tx.aiUsage.updateMany({ where: { userId }, data: { userId: null } });

  // Kurse aus dem Verkauf nehmen – bestehende Lernende behalten Zugriff
  await tx.course.updateMany({
    where: { creatorId: userId },
    data: { published: false, listedInShop: false },
  });
}

export async function deleteAccount(input: {
  confirmText: string;
}): Promise<ActionResult & { mode?: "deleted" | "anonymized" }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      apiSubscription: {
        select: { stripeSubscriptionId: true, status: true },
      },
    },
  });
  if (!user) return { ok: false, error: "unauthorized" };

  // Bestätigung: exakt die eigene E-Mail-Adresse (ohne Groß-/Kleinschreibung)
  if (input.confirmText.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "confirm_mismatch" };
  }

  // Laufendes API-Abo bei Stripe beenden – die Löschung scheitert daran
  // nicht (Kündigung lässt sich notfalls manuell nachholen)
  if (
    isStripeEnabled() &&
    user.apiSubscription?.stripeSubscriptionId &&
    user.apiSubscription.status !== "CANCELED"
  ) {
    try {
      await stripe().subscriptions.cancel(
        user.apiSubscription.stripeSubscriptionId
      );
    } catch (error) {
      console.error("[account] Stripe-Abo-Kündigung fehlgeschlagen:", error);
    }
  }

  const anonymize = await hasForeignEnrollments(user.id);

  await db.$transaction(async (tx) => {
    // Belege VOR der Löschung sichern (§147 AO – überdauert das Konto)
    await archiveFinancialRecords(tx, user);
    if (anonymize) {
      await anonymizeUser(tx, user.id);
    } else {
      await tx.user.delete({ where: { id: user.id } });
    }
  });

  // Session serverseitig beenden; der Client leitet zur Startseite
  await signOut({ redirect: false });

  return { ok: true, mode: anonymize ? "anonymized" : "deleted" };
}
