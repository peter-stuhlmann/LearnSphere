/**
 * Spaced repetition scheduling (SM-2 light) for flashcards generated from
 * quiz questions. Pure date math – persistence lives in the web app.
 */

export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;
/** Failed cards come back within the same study session. */
export const AGAIN_DELAY_MINUTES = 10;
/** Upper bound so intervals never run away (in days). */
export const MAX_INTERVAL_DAYS = 365;

export interface FlashcardState {
  /** SM-2 ease factor, never below MIN_EASE */
  ease: number;
  /** current interval in days; 0 = not yet answered correctly */
  intervalDays: number;
  /** correct reviews in a row */
  reps: number;
  /** times the card was forgotten after at least one success */
  lapses: number;
}

export type ReviewGrade = "again" | "good" | "easy";

export interface ReviewOutcome extends FlashcardState {
  dueAt: Date;
}

export function newCardState(): FlashcardState {
  return { ease: DEFAULT_EASE, intervalDays: 0, reps: 0, lapses: 0 };
}

function clampInterval(days: number): number {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Apply one review to a card. "again" resets the streak and shows the card
 * again in a few minutes; "good" follows the classic 1 → 3 → interval×ease
 * ladder; "easy" grows faster and raises the ease factor.
 */
export function reviewFlashcard(
  state: FlashcardState,
  grade: ReviewGrade,
  now: Date
): ReviewOutcome {
  const ease = Math.max(MIN_EASE, state.ease);

  if (grade === "again") {
    return {
      ease: Math.max(MIN_EASE, ease - 0.2),
      intervalDays: 0,
      reps: 0,
      // only a real lapse if the card had been learned before
      lapses: state.lapses + (state.reps > 0 ? 1 : 0),
      dueAt: addMinutes(now, AGAIN_DELAY_MINUTES),
    };
  }

  const reps = state.reps + 1;
  let intervalDays: number;
  if (grade === "easy") {
    intervalDays =
      reps === 1 ? 3 : clampInterval(state.intervalDays * ease * 1.3);
  } else {
    intervalDays =
      reps === 1 ? 1 : reps === 2 ? 3 : clampInterval(state.intervalDays * ease);
  }

  return {
    ease: grade === "easy" ? ease + 0.15 : ease,
    intervalDays,
    reps,
    lapses: state.lapses,
    dueAt: addDays(now, intervalDays),
  };
}

/** A card is due once its due date has been reached. */
export function isCardDue(dueAt: Date, now: Date): boolean {
  return dueAt.getTime() <= now.getTime();
}
