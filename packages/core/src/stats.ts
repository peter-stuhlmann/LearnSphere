export const STAT_RANGES = ["7d", "30d", "90d", "365d", "all"] as const;

export type StatRange = (typeof STAT_RANGES)[number];

const RANGE_DAYS: Record<Exclude<StatRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export function startDateForRange(range: StatRange, now: Date): Date | null {
  if (range === "all") {
    return null;
  }
  return new Date(now.getTime() - RANGE_DAYS[range] * 86_400_000);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DailyPoint {
  date: string;
  value: number;
}

/** Summiert Events pro Kalendertag (UTC) und füllt Lücken mit 0. */
export function buildDailySeries(
  events: { createdAt: Date; value: number }[],
  from: Date,
  to: Date
): DailyPoint[] {
  const sums = new Map<string, number>();
  for (const event of events) {
    const key = dayKey(event.createdAt);
    sums.set(key, (sums.get(key) ?? 0) + event.value);
  }

  const series: DailyPoint[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  const end = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  );
  while (cursor <= end) {
    const key = dayKey(cursor);
    series.push({ date: key, value: sums.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return series;
}

/** Durchschnitt der jeweils besten Versuche pro Prüfung (eine Nachkommastelle). */
export function averageBestScores(
  attempts: { quizId: string; scorePercent: number }[]
): number | null {
  if (attempts.length === 0) {
    return null;
  }
  const best = new Map<string, number>();
  for (const attempt of attempts) {
    best.set(
      attempt.quizId,
      Math.max(best.get(attempt.quizId) ?? 0, attempt.scorePercent)
    );
  }
  const values = [...best.values()];
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(average * 10) / 10;
}

/** Anteil abgeschlossener Einschreibungen in Prozent (ganzzahlig). */
export function completionRate(
  enrollments: { completedAt: Date | null }[]
): number | null {
  if (enrollments.length === 0) {
    return null;
  }
  const completed = enrollments.filter((e) => e.completedAt !== null).length;
  return Math.round((completed / enrollments.length) * 100);
}

/** Zählt Bewertungen in fünf Eimer: Index 0 = 1 Stern … Index 4 = 5 Sterne. */
export function ratingDistribution(ratings: number[]): number[] {
  const buckets = [0, 0, 0, 0, 0];
  for (const rating of ratings) {
    if (rating >= 1 && rating <= 5) {
      buckets[rating - 1] += 1;
    }
  }
  return buckets;
}

/** "3 h 25 min" bzw. "42 min" für Lernzeit-Anzeigen. */
export function formatLearningTime(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) {
    return `${minutes} min`;
  }
  return `${hours} h ${minutes % 60} min`;
}
