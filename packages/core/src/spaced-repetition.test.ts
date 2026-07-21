import { describe, expect, it } from "vitest";
import {
  AGAIN_DELAY_MINUTES,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  isCardDue,
  newCardState,
  reviewFlashcard,
} from "./spaced-repetition";

const NOW = new Date("2026-07-18T10:00:00Z");

const DAY_MS = 24 * 60 * 60 * 1000;

describe("newCardState", () => {
  it("starts unlearned with the default ease", () => {
    expect(newCardState()).toEqual({
      ease: 2.5,
      intervalDays: 0,
      reps: 0,
      lapses: 0,
    });
  });
});

describe("reviewFlashcard", () => {
  it("schedules the first correct answer for tomorrow", () => {
    const result = reviewFlashcard(newCardState(), "good", NOW);
    expect(result.intervalDays).toBe(1);
    expect(result.reps).toBe(1);
    expect(result.dueAt.getTime()).toBe(NOW.getTime() + DAY_MS);
  });

  it("schedules the second correct answer three days out", () => {
    const first = reviewFlashcard(newCardState(), "good", NOW);
    const second = reviewFlashcard(first, "good", NOW);
    expect(second.intervalDays).toBe(3);
    expect(second.reps).toBe(2);
  });

  it("multiplies the interval by the ease factor afterwards", () => {
    const state = { ease: 2.5, intervalDays: 3, reps: 2, lapses: 0 };
    const result = reviewFlashcard(state, "good", NOW);
    expect(result.intervalDays).toBe(8); // round(3 × 2.5)
    expect(result.dueAt.getTime()).toBe(NOW.getTime() + 8 * DAY_MS);
  });

  it("keeps the ease factor unchanged on good", () => {
    const result = reviewFlashcard(newCardState(), "good", NOW);
    expect(result.ease).toBe(2.5);
  });

  it("grows faster and raises ease on easy", () => {
    const result = reviewFlashcard(newCardState(), "easy", NOW);
    expect(result.intervalDays).toBe(3);
    expect(result.ease).toBe(2.65);
  });

  it("applies the easy bonus to later intervals", () => {
    const state = { ease: 2.5, intervalDays: 3, reps: 2, lapses: 0 };
    const result = reviewFlashcard(state, "easy", NOW);
    expect(result.intervalDays).toBe(10); // round(3 × 2.5 × 1.3)
  });

  it("resets the card and brings it back within minutes on again", () => {
    const state = { ease: 2.5, intervalDays: 8, reps: 3, lapses: 0 };
    const result = reviewFlashcard(state, "again", NOW);
    expect(result.intervalDays).toBe(0);
    expect(result.reps).toBe(0);
    expect(result.lapses).toBe(1);
    expect(result.ease).toBe(2.3);
    expect(result.dueAt.getTime()).toBe(
      NOW.getTime() + AGAIN_DELAY_MINUTES * 60 * 1000
    );
  });

  it("does not count a lapse for cards never answered correctly", () => {
    const result = reviewFlashcard(newCardState(), "again", NOW);
    expect(result.lapses).toBe(0);
  });

  it("never drops the ease below the minimum", () => {
    const state = { ease: 1.35, intervalDays: 2, reps: 1, lapses: 4 };
    const result = reviewFlashcard(state, "again", NOW);
    expect(result.ease).toBe(MIN_EASE);
  });

  it("repairs an ease below the minimum before applying it", () => {
    const state = { ease: 0.5, intervalDays: 10, reps: 3, lapses: 0 };
    const result = reviewFlashcard(state, "good", NOW);
    expect(result.intervalDays).toBe(13); // round(10 × 1.3)
    expect(result.ease).toBe(MIN_EASE);
  });

  it("caps the interval at one year", () => {
    const state = { ease: 2.5, intervalDays: 300, reps: 8, lapses: 0 };
    const result = reviewFlashcard(state, "good", NOW);
    expect(result.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it("never produces an interval below one day for correct answers", () => {
    const state = { ease: 1.3, intervalDays: 0, reps: 5, lapses: 0 };
    const result = reviewFlashcard(state, "good", NOW);
    expect(result.intervalDays).toBeGreaterThanOrEqual(1);
  });
});

describe("isCardDue", () => {
  it("is due at or before now", () => {
    expect(isCardDue(NOW, NOW)).toBe(true);
    expect(isCardDue(new Date(NOW.getTime() - 1), NOW)).toBe(true);
  });

  it("is not due in the future", () => {
    expect(isCardDue(new Date(NOW.getTime() + 1), NOW)).toBe(false);
  });
});
