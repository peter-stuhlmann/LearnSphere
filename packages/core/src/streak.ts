/**
 * Learning streaks based on activity days. A day is a UTC calendar day
 * ("YYYY-MM-DD") – written once per day on any learning activity.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC calendar day of a date, e.g. "2026-07-18". */
export function utcDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Day string N days before the given day. */
export function shiftDay(day: string, deltaDays: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  return utcDayString(new Date(date.getTime() + deltaDays * DAY_MS));
}

/**
 * Current streak in days: consecutive active days ending today – or ending
 * yesterday, so the streak is not shown as broken before the learner had a
 * chance to practice today.
 */
export function computeStreak(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  const start = set.has(today) ? today : shiftDay(today, -1);
  if (!set.has(start)) return 0;

  let streak = 0;
  let cursor = start;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/**
 * Activity for the last 7 days (oldest first, last entry = today) – for the
 * little week strip in the dashboard greeting.
 */
export function weekActivity(
  days: Iterable<string>,
  today: string
): { day: string; active: boolean }[] {
  const set = new Set(days);
  const result: { day: string; active: boolean }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = shiftDay(today, -i);
    result.push({ day, active: set.has(day) });
  }
  return result;
}
