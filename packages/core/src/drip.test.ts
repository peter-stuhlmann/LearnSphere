import { describe, expect, it } from "vitest";
import { hasDripRules, sectionLockState } from "./drip";

const ENROLLED = new Date("2026-07-01T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function ctx(overrides: Partial<Parameters<typeof sectionLockState>[1]> = {}) {
  return {
    enrolledAt: ENROLLED,
    now: new Date("2026-07-10T12:00:00Z"),
    previousQuizPassed: null,
    ...overrides,
  };
}

describe("sectionLockState", () => {
  it("is unlocked without any rules", () => {
    expect(
      sectionLockState({ dripAfterDays: null, dripAfterQuiz: false }, ctx())
    ).toEqual({ locked: false, unlocksAt: null, requiresPreviousQuiz: false });
  });

  it("treats 0 days like no time rule", () => {
    expect(
      sectionLockState({ dripAfterDays: 0, dripAfterQuiz: false }, ctx()).locked
    ).toBe(false);
  });

  it("locks until N days after enrollment", () => {
    const state = sectionLockState(
      { dripAfterDays: 14, dripAfterQuiz: false },
      ctx()
    );
    expect(state.locked).toBe(true);
    expect(state.unlocksAt?.getTime()).toBe(ENROLLED.getTime() + 14 * DAY_MS);
    expect(state.requiresPreviousQuiz).toBe(false);
  });

  it("unlocks exactly when the time gate is reached", () => {
    const state = sectionLockState(
      { dripAfterDays: 9, dripAfterQuiz: false },
      ctx({ now: new Date(ENROLLED.getTime() + 9 * DAY_MS) })
    );
    expect(state.locked).toBe(false);
    expect(state.unlocksAt).toBeNull();
  });

  it("locks while the previous section's quiz is not passed", () => {
    const state = sectionLockState(
      { dripAfterDays: null, dripAfterQuiz: true },
      ctx({ previousQuizPassed: false })
    );
    expect(state.locked).toBe(true);
    expect(state.requiresPreviousQuiz).toBe(true);
    expect(state.unlocksAt).toBeNull();
  });

  it("unlocks once the previous quiz is passed", () => {
    const state = sectionLockState(
      { dripAfterDays: null, dripAfterQuiz: true },
      ctx({ previousQuizPassed: true })
    );
    expect(state.locked).toBe(false);
  });

  it("ignores the quiz rule when there is nothing to pass", () => {
    const state = sectionLockState(
      { dripAfterDays: null, dripAfterQuiz: true },
      ctx({ previousQuizPassed: null })
    );
    expect(state.locked).toBe(false);
  });

  it("reports both gates when both are unfulfilled", () => {
    const state = sectionLockState(
      { dripAfterDays: 30, dripAfterQuiz: true },
      ctx({ previousQuizPassed: false })
    );
    expect(state.locked).toBe(true);
    expect(state.unlocksAt).not.toBeNull();
    expect(state.requiresPreviousQuiz).toBe(true);
  });
});

describe("hasDripRules", () => {
  it("detects configured rules", () => {
    expect(hasDripRules({ dripAfterDays: null, dripAfterQuiz: false })).toBe(
      false
    );
    expect(hasDripRules({ dripAfterDays: 0, dripAfterQuiz: false })).toBe(
      false
    );
    expect(hasDripRules({ dripAfterDays: 7, dripAfterQuiz: false })).toBe(true);
    expect(hasDripRules({ dripAfterDays: null, dripAfterQuiz: true })).toBe(
      true
    );
  });
});
