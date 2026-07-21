/** Auszahlungen erst ab 10 € Guthaben. */
export const MIN_PAYOUT_CENTS = 1000;

/**
 * Sperrfrist: Erlöse (Creator-Anteile, Affiliate-Provisionen) werden erst
 * 30 Tage nach dem Kauf freigegeben – solange läuft das Rückgaberecht.
 */
export const EARNINGS_HOLD_DAYS = 30;

/** Käufe bis zu diesem Zeitpunkt sind freigegeben; alles danach ist „in Prüfung“. */
export function earningsClearedCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - EARNINGS_HOLD_DAYS * 24 * 60 * 60 * 1000);
}

export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

/**
 * IBAN-Prüfung nach ISO 13616: Länge/Format plus Mod-97-Prüfsumme
 * (Buchstaben → Zahlen, Rest muss 1 ergeben).
 */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return false;
  }

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const value = /[A-Z]/.test(char)
      ? (char.charCodeAt(0) - 55).toString()
      : char;
    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/** "DE89 •••• 3000" – für die Anzeige gespeicherter Bankdaten. */
export function maskIban(iban: string): string {
  const normalized = normalizeIban(iban);
  return `${normalized.slice(0, 4)} •••• ${normalized.slice(-4)}`;
}

export type PayoutCheck =
  | { ok: true }
  | { ok: false; error: "below_minimum" | "no_bank_account" | "request_pending" };

export function canRequestPayout(input: {
  balanceCents: number;
  hasOpenRequest: boolean;
  hasIban: boolean;
}): PayoutCheck {
  if (!input.hasIban) {
    return { ok: false, error: "no_bank_account" };
  }
  if (input.hasOpenRequest) {
    return { ok: false, error: "request_pending" };
  }
  if (input.balanceCents < MIN_PAYOUT_CENTS) {
    return { ok: false, error: "below_minimum" };
  }
  return { ok: true };
}
