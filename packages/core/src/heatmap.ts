/**
 * Video-Heatmap: Während der Wiedergabe zählt jeder Nutzer je Zeit-Bucket
 * (40 relative Abschnitte pro Medium) höchstens einmal pro Sitzung.
 * Creator sehen daraus, wo Lernende abspringen oder wiederholen; Lernende
 * bekommen eine dezente "Oft geschaut"-Kurve über der Timeline.
 */

export const HEAT_BUCKETS = 40;

/** Mindest-Datenpunkte, bevor die Kurve für Lernende sichtbar wird. */
export const HEAT_MIN_TOTAL = 30;

/** Abspielsekunde → Bucket-Index (0..HEAT_BUCKETS-1); -1 ohne Dauer. */
export function bucketIndexFor(
  seconds: number,
  durationSeconds: number
): number {
  if (durationSeconds <= 0 || seconds < 0) return -1;
  const index = Math.floor((seconds / durationSeconds) * HEAT_BUCKETS);
  return Math.min(HEAT_BUCKETS - 1, Math.max(0, index));
}

/** Eingehende Bucket-Liste bereinigen: ints im Bereich, dedupliziert. */
export function sanitizeBuckets(buckets: unknown): number[] {
  if (!Array.isArray(buckets)) return [];
  const seen = new Set<number>();
  for (const value of buckets) {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < HEAT_BUCKETS
    ) {
      seen.add(value);
    }
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Aggregierte Zähler → normalisierte Kurve (0..1 je Bucket).
 * null, wenn insgesamt zu wenig Datenpunkte da sind (Rauschen).
 */
export function normalizeHeat(
  rows: { bucket: number; views: number }[]
): number[] | null {
  const counts = new Array<number>(HEAT_BUCKETS).fill(0);
  let total = 0;
  for (const row of rows) {
    if (row.bucket >= 0 && row.bucket < HEAT_BUCKETS && row.views > 0) {
      counts[row.bucket] += row.views;
      total += row.views;
    }
  }
  if (total < HEAT_MIN_TOTAL) return null;
  // total ≥ Mindestmenge ⇒ mindestens ein Bucket > 0 ⇒ max ≥ 1
  const max = Math.max(...counts);
  return counts.map((count) => count / max);
}

/** SVG-Pfad (Fläche) der Kurve für eine 100×20-Viewbox. */
export function heatAreaPath(heat: number[]): string {
  if (heat.length === 0) return "";
  const step = 100 / heat.length;
  const points = heat.map((value, index) => {
    const x = index * step + step / 2;
    const y = 20 - value * 18;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M0,20 L${points.join(" L")} L100,20 Z`;
}
