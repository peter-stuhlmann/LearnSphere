/**
 * 30-Tage-Rückgabegarantie für bezahlte Kurse (freiwillige Garantie,
 * großzügiger als das gesetzliche Widerrufsrecht):
 * - Rückgabe ohne Angabe von Gründen (wir fragen optional danach)
 * - Zugriff erlischt sofort, Kaufpreis wird erstattet
 * - Solange die Garantie läuft, ist die ABSCHLUSSPRÜFUNG gesperrt
 *   (kein Zertifikat für zurückgebbare Käufe) – wer früher prüfen will,
 *   beendet die Garantie freiwillig vorzeitig (guaranteeWaivedAt).
 * Die Frist deckt sich mit EARNINGS_HOLD_DAYS: Creator-Erlöse werden erst
 * nach Ablauf des Rückgabefensters zur Auszahlung freigegeben.
 */

export const REFUND_GUARANTEE_DAYS = 30;

/** Ende des Rückgabefensters für einen Kauf. */
export function refundDeadline(purchasedAt: Date): Date {
  return new Date(
    purchasedAt.getTime() + REFUND_GUARANTEE_DAYS * 24 * 60 * 60 * 1000
  );
}

export interface GuaranteeState {
  /** Ende des Rückgabefensters; null = kein Rückgaberecht (z. B. gratis) */
  refundableUntil: Date | null;
  /** Nutzer hat die Garantie vorzeitig beendet (Prüfung freigeschaltet) */
  guaranteeWaivedAt: Date | null;
}

/** Läuft die Rückgabegarantie gerade? (→ Rückgabe möglich, Prüfung gesperrt) */
export function isGuaranteeActive(
  state: GuaranteeState,
  now: Date = new Date()
): boolean {
  if (!state.refundableUntil) return false;
  if (state.guaranteeWaivedAt) return false;
  return state.refundableUntil.getTime() > now.getTime();
}

/** Optionaler Rückgabe-Grund: getrimmt, begrenzt, leer → null. */
export function normalizeRefundReason(reason: unknown): string | null {
  if (typeof reason !== "string") return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 2000);
}
