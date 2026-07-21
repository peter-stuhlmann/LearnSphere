const FREE_LABELS: Record<string, string> = {
  de: "Kostenlos",
  en: "Free",
};

export function formatPrice(
  cents: number,
  currency: string,
  locale: string
): string {
  if (cents === 0) {
    return FREE_LABELS[locale] ?? FREE_LABELS.en;
  }
  return formatMoney(cents, currency, locale);
}

/** Geldbetrag immer numerisch – 0 ist „0,00 €", nicht „Kostenlos" (Guthaben, Umsätze). */
export function formatMoney(
  cents: number,
  currency: string,
  locale: string
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const two = (n: number) => n.toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${two(minutes)}:${two(seconds)}`;
  }
  return `${minutes}:${two(seconds)}`;
}
