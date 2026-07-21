/**
 * In-App-Kauf-Preisstufen: App Store / Play Store kennen nur vordefinierte
 * Produkte, Creator-Preise sind aber frei. Lösung: feste Tier-Produkte
 * (einmalig in beiden Stores angelegt); ein Kurs wird auf die KLEINSTE
 * Stufe ≥ Webpreis gemappt – der Creator bekommt nie weniger als im Web.
 * Die Produkt-IDs sind in App Store Connect / Play Console identisch.
 */

export const IAP_TIER_CENTS = [
  499, 999, 1499, 1999, 2499, 2999, 3999, 4999, 5999, 7499, 9999, 12499,
  14999, 19999, 24999, 29999,
] as const;

export type IapTierCents = (typeof IAP_TIER_CENTS)[number];

/** höchster verkaufbarer In-App-Preis (darüber: nur Web-Kauf) */
export const IAP_MAX_TIER_CENTS = IAP_TIER_CENTS[IAP_TIER_CENTS.length - 1];

export function tierProductId(tierCents: IapTierCents): string {
  return `course_tier_${String(tierCents).padStart(5, "0")}`;
}

export interface IapTier {
  productId: string;
  tierCents: IapTierCents;
}

/**
 * Kurs-Preis → Tier-Produkt (kleinste Stufe ≥ Preis).
 * null bei Gratiskursen (kein Kauf nötig) und Preisen über der
 * höchsten Stufe (nur im Web kaufbar).
 */
export function priceCentsToTier(priceCents: number): IapTier | null {
  if (priceCents <= 0) return null;
  const tierCents = IAP_TIER_CENTS.find((tier) => tier >= priceCents);
  if (tierCents === undefined) return null;
  return { productId: tierProductId(tierCents), tierCents };
}

/** Produkt-ID → Tier-Cents (Verifikation: productId gegen Intent prüfen). */
export function tierCentsForProductId(
  productId: string
): IapTierCents | null {
  const match = /^course_tier_(\d{5})$/.exec(productId);
  if (!match) return null;
  const cents = Number(match[1]);
  return (IAP_TIER_CENTS as readonly number[]).includes(cents)
    ? (cents as IapTierCents)
    : null;
}
