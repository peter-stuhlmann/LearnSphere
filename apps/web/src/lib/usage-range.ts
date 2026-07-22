/**
 * Zeitraum-Auswahl des KI-Verbrauchs.
 *
 * Voreinstellungen (heute, gestern, 7/30/90 Tage, 1 Jahr) und ein frei
 * wählbarer Zeitraum landen beide in derselben Form: ein Startdatum, ein
 * exklusives Enddatum und die Zahl der Tage dazwischen.
 *
 * Gerechnet wird in UTC-Tagen, weil die Tagesreihen der Diagramme
 * (stackedDailySeries) es ebenso tun – zwei verschiedene Tagesbegriffe im
 * selben Bild ergäben verschobene Balken. Der Server läuft in UTC.
 *
 * Anders als früher gibt es jetzt eine OBERE Grenze. "Gestern" oder ein
 * Zeitraum aus dem letzten Monat wären ohne sie sinnlos: Die alte Abfrage
 * kannte nur "ab Datum X".
 */

export const USAGE_PRESETS = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "90d",
  "365d",
] as const;

export type UsagePreset = (typeof USAGE_PRESETS)[number];

export const DEFAULT_USAGE_PRESET: UsagePreset = "30d";

/** Zahl der Tage, die eine Voreinstellung umfasst (heute eingeschlossen). */
const PRESET_DAYS: Record<UsagePreset, number> = {
  today: 1,
  yesterday: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

/** Höchstspanne eines frei gewählten Zeitraums – gegen Abfragen über Jahre. */
export const MAX_RANGE_DAYS = 366;

const DAY_MS = 86_400_000;

export function isUsagePreset(value: string): value is UsagePreset {
  return (USAGE_PRESETS as readonly string[]).includes(value);
}

/** Mitternacht (UTC) des Tages, in dem dieser Zeitpunkt liegt. */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/** "YYYY-MM-DD" – dieselbe Schreibweise wie in der URL und den Diagrammen. */
export function toIsoDay(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" einlesen; alles andere ergibt null (statt Invalid Date). */
export function parseIsoDay(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Fängt Scheindaten wie 2026-02-31 ab, die JS sonst weiterrollt
  return toIsoDay(date) === value ? date : null;
}

export interface ResolvedUsageRange {
  /** Beginn, einschließlich */
  from: Date;
  /** Ende, ausschließlich (Mitternacht des Folgetags) */
  toExclusive: Date;
  /** Letzter enthaltener Tag – für die Anzeige */
  to: Date;
  days: number;
  /** Voreinstellung oder "custom" */
  preset: UsagePreset | "custom";
}

/**
 * Zeitraum aus den URL-Parametern bestimmen. Ungültige Eingaben fallen
 * still auf die Voreinstellung zurück – die Seite ist öffentlich
 * verlinkbar, eine kaputte URL darf sie nicht zerlegen.
 */
export function resolveUsageRange(params: {
  range?: string;
  from?: string;
  to?: string;
  now: Date;
}): ResolvedUsageRange {
  const today = startOfUtcDay(params.now);

  // Frei gewählter Zeitraum hat Vorrang, wenn beide Daten taugen
  const customFrom = parseIsoDay(params.from);
  const customTo = parseIsoDay(params.to);
  if (customFrom && customTo) {
    // vertauschte Eingaben stillschweigend drehen
    const [start, end] =
      customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
    const span = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
    if (span <= MAX_RANGE_DAYS) {
      return {
        from: start,
        to: end,
        toExclusive: new Date(end.getTime() + DAY_MS),
        days: span,
        preset: "custom",
      };
    }
  }

  const preset =
    params.range && isUsagePreset(params.range)
      ? params.range
      : DEFAULT_USAGE_PRESET;

  // "Gestern" ist der einzige Zeitraum, der nicht heute endet
  const end = preset === "yesterday" ? new Date(today.getTime() - DAY_MS) : today;
  const days = PRESET_DAYS[preset];
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);

  return {
    from: start,
    to: end,
    toExclusive: new Date(end.getTime() + DAY_MS),
    days,
    preset,
  };
}
