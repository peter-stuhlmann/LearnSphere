import { db } from "@/lib/db";
import { earningsClearedCutoff } from "@elearning/core/payout";
import { isStripeEnabled, stripe } from "@/lib/stripe";

/**
 * Automatische Auszahlung: Ist der Creator per Stripe Connect verbunden,
 * wird der Betrag sofort als Transfer überwiesen und der Antrag als PAID
 * markiert. Scheitert der Transfer (kein Connect, kein Guthaben, API-Fehler),
 * bleibt der Antrag REQUESTED und landet in der Admin-Warteschlange
 * (/admin/payouts) zur manuellen IBAN-Überweisung.
 */
export async function attemptAutoTransfer(payoutId: string): Promise<boolean> {
  if (!isStripeEnabled()) return false;

  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      amountCents: true,
      status: true,
      user: { select: { stripeAccountId: true, stripeChargesEnabled: true } },
    },
  });
  if (
    !payout ||
    payout.status !== "REQUESTED" ||
    !payout.user.stripeAccountId ||
    !payout.user.stripeChargesEnabled
  ) {
    return false;
  }

  try {
    await stripe().transfers.create({
      amount: payout.amountCents,
      currency: "eur",
      destination: payout.user.stripeAccountId,
      description: "LearnSphere Creator-Auszahlung",
      metadata: { payoutId: payout.id },
    });
  } catch (error) {
    console.error("[payout] Stripe-Transfer fehlgeschlagen:", error);
    return false;
  }

  await db.payout.update({
    where: { id: payout.id },
    data: { status: "PAID", paidAt: new Date() },
  });
  return true;
}

export interface PayoutSummary {
  /** auszahlbares Guthaben in Cent (freigegebene Erlöse minus Auszahlungen) */
  balanceCents: number;
  /** Erlöse in der 30-Tage-Sperrfrist (Rückgaberecht) – noch nicht verfügbar */
  pendingCents: number;
  hasOpenRequest: boolean;
  holder: string;
  iban: string;
  history: {
    id: string;
    amountCents: number;
    status: "REQUESTED" | "PAID";
    createdAt: string;
  }[];
}

interface EarningsBreakdown {
  /** freigegebene Erlöse (Käufe älter als 30 Tage) */
  clearedCents: number;
  /** alle Erlöse (freigegeben + Sperrfrist) */
  totalCents: number;
  /** bereits ausgegeben: Auszahlungen + beim Kurskauf eingesetztes Guthaben */
  spentCents: number;
}

async function loadEarningsBreakdown(
  userId: string
): Promise<EarningsBreakdown> {
  const cutoff = earningsClearedCutoff();
  const [earnedAll, earnedCleared, affiliateAll, affiliateCleared, creditUsed, payouts] =
    await Promise.all([
      db.enrollment.aggregate({
        where: { course: { creatorId: userId }, paidViaConnect: false },
        _sum: { creatorShareCents: true },
      }),
      db.enrollment.aggregate({
        where: {
          course: { creatorId: userId },
          paidViaConnect: false,
          createdAt: { lte: cutoff },
        },
        _sum: { creatorShareCents: true },
      }),
      db.enrollment.aggregate({
        where: { affiliateUserId: userId },
        _sum: { affiliateShareCents: true },
      }),
      db.enrollment.aggregate({
        where: { affiliateUserId: userId, createdAt: { lte: cutoff } },
        _sum: { affiliateShareCents: true },
      }),
      db.enrollment.aggregate({
        where: { userId },
        _sum: { creditUsedCents: true },
      }),
      db.payout.aggregate({
        where: { userId },
        _sum: { amountCents: true },
      }),
    ]);

  return {
    clearedCents:
      (earnedCleared._sum.creatorShareCents ?? 0) +
      (affiliateCleared._sum.affiliateShareCents ?? 0),
    totalCents:
      (earnedAll._sum.creatorShareCents ?? 0) +
      (affiliateAll._sum.affiliateShareCents ?? 0),
    spentCents:
      (creditUsed._sum.creditUsedCents ?? 0) +
      (payouts._sum.amountCents ?? 0),
  };
}

/**
 * Verfügbar + in Prüfung ergeben immer den tatsächlich geschuldeten Betrag
 * (alle Erlöse minus Ausgegebenes) – beides nie negativ. Wurde bereits mehr
 * ausgegeben als aktuell freigegeben ist (z. B. Auszahlung vor Einführung
 * der Sperrfrist), ist das Verfügbare 0 und der Rest zählt als „in Prüfung“.
 */
function availableFrom(b: EarningsBreakdown): number {
  return Math.max(0, Math.min(b.clearedCents, b.totalCents) - b.spentCents);
}

function pendingFrom(b: EarningsBreakdown): number {
  const owed = Math.max(0, b.totalCents - b.spentCents);
  return Math.max(0, owed - availableFrom(b));
}

/** Auszahlbares Guthaben (freigegebene Erlöse minus Ausgegebenes, nie negativ). */
export async function loadBalanceCents(userId: string): Promise<number> {
  return availableFrom(await loadEarningsBreakdown(userId));
}

/** Erlöse, die noch nicht verfügbar sind (30-Tage-Sperrfrist). */
export async function loadPendingCents(userId: string): Promise<number> {
  return pendingFrom(await loadEarningsBreakdown(userId));
}

export async function loadPayoutSummary(userId: string): Promise<PayoutSummary> {
  const [breakdown, payouts, user] = await Promise.all([
    loadEarningsBreakdown(userId),
    db.payout.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, amountCents: true, status: true, createdAt: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { payoutHolder: true, payoutIban: true },
    }),
  ]);

  return {
    balanceCents: availableFrom(breakdown),
    pendingCents: pendingFrom(breakdown),
    hasOpenRequest: payouts.some((p) => p.status === "REQUESTED"),
    holder: user?.payoutHolder ?? "",
    iban: user?.payoutIban ?? "",
    history: payouts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
