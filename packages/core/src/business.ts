/**
 * LearnSphere Business: Einmal-Zertifizierungskäufe je Kurs und die
 * Erlösaufteilung. Reine Logik ohne Seiteneffekte (TDD).
 *
 * Preis-Modell (Einmalkauf, kein Abo): Ein Unternehmen kauft N Zertifizierungs-
 * Seats für einen Kurs. Der Seat-Preis ist der Kurspreis abzüglich eines
 * Mengenrabatts (mehr Seats → höherer Rabatt), einmalig zu zahlen. Der Preis
 * wird beim Kauf eingefroren.
 *
 * Aufteilung des Erlöses (kanal-neutral zum Plattform-Direktverkauf):
 * - 50 % Creator des Kurses (ist der Business-Inhaber selbst der Creator,
 *   geht auch dieser Anteil an LearnSphere)
 * - 15 % Affiliate (nur wenn ein Werber attribuiert ist, sonst LearnSphere)
 * - Rest LearnSphere
 */

/** Mindest-Seats je Bestellung – faktisch kein Minimum, 1 genügt. */
export const BUSINESS_MIN_SEATS = 1;
export const BUSINESS_MAX_SEATS = 10_000;

/** Untergrenze je Seat in Cent – schützt günstige/kostenlose Kurse. */
export const BUSINESS_MIN_SEAT_CENTS = 400;

/**
 * Mengenrabatt-Staffeln (absteigend nach minSeats): ab so vielen Seats gilt der
 * Rabatt auf den Kurspreis je Seat. Editierbar.
 */
export const BUSINESS_VOLUME_DISCOUNTS = [
  { minSeats: 25, rate: 0.3 },
  { minSeats: 10, rate: 0.2 },
  { minSeats: 3, rate: 0.1 },
] as const;

const AFFILIATE_RATE = 0.15;
const CREATOR_RATE = 0.5;

export function validateSeatCount(seats: number): boolean {
  return (
    Number.isInteger(seats) &&
    seats >= BUSINESS_MIN_SEATS &&
    seats <= BUSINESS_MAX_SEATS
  );
}

/** Mengenrabatt-Satz (0…1) für die Seat-Anzahl gemäß den Staffeln. */
export function businessVolumeDiscountRate(seats: number): number {
  for (const tier of BUSINESS_VOLUME_DISCOUNTS) {
    if (seats >= tier.minSeats) return tier.rate;
  }
  return 0;
}

/**
 * Einmaliger Seat-Preis in Cent: Kurspreis abzüglich Mengenrabatt, jedoch nie
 * unter der Untergrenze (kostenlose/günstige Kurse landen auf ihr).
 */
export function businessSeatPriceCents(
  coursePriceCents: number,
  seats: number
): number {
  const rate = businessVolumeDiscountRate(seats);
  const discounted = Math.round(coursePriceCents * (1 - rate));
  return Math.max(BUSINESS_MIN_SEAT_CENTS, discounted);
}

/** Gesamtbetrag der Bestellung in Cent = Seats × (rabattierter) Seat-Preis. */
export function businessOrderTotalCents(
  coursePriceCents: number,
  seats: number
): number {
  return businessSeatPriceCents(coursePriceCents, seats) * seats;
}

export interface BusinessRevenueSplit {
  learnsphereCents: number;
  affiliateCents: number;
  creatorCents: number;
}

/**
 * Erlös eines Abrechnungszeitraums aufteilen. Anteile werden abgerundet,
 * Rundungsreste verbleiben bei LearnSphere – die Summe bleibt exakt.
 */
export function businessRevenueSplitCents(input: {
  totalCents: number;
  creatorIsOwner: boolean;
  hasAffiliate: boolean;
}): BusinessRevenueSplit {
  const affiliateCents = input.hasAffiliate
    ? Math.floor(input.totalCents * AFFILIATE_RATE)
    : 0;
  const creatorCents = input.creatorIsOwner
    ? 0
    : Math.floor(input.totalCents * CREATOR_RATE);
  return {
    learnsphereCents: input.totalCents - affiliateCents - creatorCents,
    affiliateCents,
    creatorCents,
  };
}
