export type SalesChannelName = "PLATFORM" | "EXTERNAL";

/**
 * Umsatzbeteiligung pro Verkaufskanal:
 * - PLATFORM: Verkauf über LearnSphere (Shop, Storefront, Kursseite) → 50 %
 * - EXTERNAL: Verkauf über eigene Kanäle (API, Embed-Widget) → 75 %
 * Der Rest geht an LearnSphere. Keine festen monatlichen Kosten.
 */
export const CREATOR_SHARE_PERCENT: Record<SalesChannelName, number> = {
  PLATFORM: 50,
  EXTERNAL: 75,
};

export function creatorShareCents(
  amountCents: number,
  channel: SalesChannelName | string
): number {
  const percent =
    CREATOR_SHARE_PERCENT[channel as SalesChannelName] ??
    CREATOR_SHARE_PERCENT.PLATFORM;
  return Math.round((amountCents * percent) / 100);
}

/** Plattform-Anteil = Rest, damit Anteil + Gebühr exakt die Summe ergibt. */
export function platformFeeCents(
  amountCents: number,
  channel: SalesChannelName | string
): number {
  return amountCents - creatorShareCents(amountCents, channel);
}

/** Affiliate-Provision: 15 % vom bezahlten Preis (Rest nach Creator-Anteil trägt LearnSphere). */
export const AFFILIATE_SHARE_PERCENT = 15;

export function affiliateShareCents(amountCents: number): number {
  return Math.round((amountCents * AFFILIATE_SHARE_PERCENT) / 100);
}

/**
 * In-App-Käufe (App Store / Play Store): Die Store-Provision (15 % im
 * Small-Business-Programm, sonst 30 %) geht vom Brutto ab; der Creator-
 * Anteil wird auf dem NETTO berechnet – die Store-Gebühr tragen Creator
 * und Plattform anteilig, nicht die Plattform allein.
 */
export function storeFeeCents(
  grossCents: number,
  commissionPercent: number
): number {
  return Math.round((grossCents * commissionPercent) / 100);
}

export function iapCreatorShareCents(
  grossCents: number,
  commissionPercent: number
): number {
  return creatorShareCents(
    grossCents - storeFeeCents(grossCents, commissionPercent),
    "PLATFORM"
  );
}
