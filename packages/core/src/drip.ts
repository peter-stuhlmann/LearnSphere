/**
 * Drip content: sections can unlock after a number of days since enrollment
 * and/or after passing the previous section's quiz. Both rules are optional
 * and combinable – pure logic, evaluated per learner.
 */

export interface DripRules {
  /** unlock N days after enrollment; null/0 = immediately */
  dripAfterDays: number | null;
  /** unlock only after the previous section's quiz was passed */
  dripAfterQuiz: boolean;
}

export interface DripContext {
  enrolledAt: Date;
  now: Date;
  /**
   * Did the learner pass the previous section's quiz?
   * null = there is no previous section or it has no quiz (nothing to pass).
   */
  previousQuizPassed: boolean | null;
}

export interface SectionLockState {
  locked: boolean;
  /** time gate not yet reached – unlocks at this moment */
  unlocksAt: Date | null;
  /** quiz gate not yet fulfilled */
  requiresPreviousQuiz: boolean;
}

function dayMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

/** Evaluate a section's drip rules for one learner. */
export function sectionLockState(
  rules: DripRules,
  context: DripContext
): SectionLockState {
  const days = rules.dripAfterDays ?? 0;
  const unlocksAt =
    days > 0 ? new Date(context.enrolledAt.getTime() + dayMs(days)) : null;
  const timeLocked =
    unlocksAt !== null && context.now.getTime() < unlocksAt.getTime();
  const quizLocked =
    rules.dripAfterQuiz && context.previousQuizPassed === false;

  return {
    locked: timeLocked || quizLocked,
    unlocksAt: timeLocked ? unlocksAt : null,
    requiresPreviousQuiz: quizLocked,
  };
}

/** Are any drip rules configured on this section at all? */
export function hasDripRules(rules: DripRules): boolean {
  return (rules.dripAfterDays ?? 0) > 0 || rules.dripAfterQuiz;
}
