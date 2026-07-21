export interface LessonProgressInput {
  watchedSeconds: number;
  durationSeconds: number;
}

export interface ExamEligibilityInput {
  watchPercent: number;
  requiredWatchPercent: number;
  sectionQuizzesPassed: boolean[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Fraction (0..1) of a lesson that counts as watched. Lessons without a
 * duration (files, text) are binary: opened or not.
 */
export function lessonWatchRatio(
  watchedSeconds: number,
  durationSeconds: number
): number {
  const watched = Math.max(0, watchedSeconds);
  if (durationSeconds <= 0) {
    return watched > 0 ? 1 : 0;
  }
  return Math.min(1, watched / durationSeconds);
}

/**
 * Duration-weighted watch percent (0..100) across all lessons of a course.
 * Lessons without duration are weighted with the average duration of the
 * timed lessons so that a short text lesson cannot dominate a long video.
 */
export function courseWatchPercent(items: LessonProgressInput[]): number {
  if (items.length === 0) {
    return 100;
  }
  const timed = items.filter((i) => i.durationSeconds > 0);
  const untimed = items.filter((i) => i.durationSeconds <= 0);
  const averageDuration =
    timed.length > 0
      ? timed.reduce((sum, i) => sum + i.durationSeconds, 0) / timed.length
      : 1;

  let watched = 0;
  let total = 0;
  for (const item of timed) {
    watched += Math.min(Math.max(0, item.watchedSeconds), item.durationSeconds);
    total += item.durationSeconds;
  }
  for (const item of untimed) {
    watched += lessonWatchRatio(item.watchedSeconds, 0) * averageDuration;
    total += averageDuration;
  }
  return round2((watched / total) * 100);
}

/**
 * A learner may take the final exam once they reached the course's required
 * watch percent and passed every section quiz.
 */
export function isEligibleForExam(input: ExamEligibilityInput): boolean {
  return (
    input.watchPercent >= input.requiredWatchPercent &&
    input.sectionQuizzesPassed.every(Boolean)
  );
}
