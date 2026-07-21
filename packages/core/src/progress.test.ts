import { describe, expect, it } from "vitest";
import {
  courseWatchPercent,
  isEligibleForExam,
  lessonWatchRatio,
} from "./progress";

describe("lessonWatchRatio", () => {
  it("returns 0 when nothing was watched", () => {
    expect(lessonWatchRatio(0, 600)).toBe(0);
  });

  it("returns the watched fraction", () => {
    expect(lessonWatchRatio(300, 600)).toBe(0.5);
  });

  it("caps at 1 even if more than the duration was watched", () => {
    expect(lessonWatchRatio(900, 600)).toBe(1);
  });

  it("treats lessons without duration (files/text) as binary", () => {
    expect(lessonWatchRatio(0, 0)).toBe(0);
    expect(lessonWatchRatio(1, 0)).toBe(1);
  });

  it("never returns negative values", () => {
    expect(lessonWatchRatio(-5, 600)).toBe(0);
    expect(lessonWatchRatio(-5, 0)).toBe(0);
  });
});

describe("courseWatchPercent", () => {
  it("returns 100 for a course without lessons", () => {
    expect(courseWatchPercent([])).toBe(100);
  });

  it("weights lessons by duration", () => {
    const percent = courseWatchPercent([
      { watchedSeconds: 600, durationSeconds: 600 }, // fully watched, 10 min
      { watchedSeconds: 0, durationSeconds: 200 }, // unwatched, ~3 min
    ]);
    expect(percent).toBe(75);
  });

  it("counts duration-less lessons as one unit of the average", () => {
    const percent = courseWatchPercent([
      { watchedSeconds: 1, durationSeconds: 0 },
      { watchedSeconds: 0, durationSeconds: 0 },
    ]);
    expect(percent).toBe(50);
  });

  it("mixes timed and untimed lessons", () => {
    // timed part: 300/600 = 0.5 → weight of timed pool
    // untimed lesson completed → 1
    // pooled: (0.5 * 600 + 1 * 600/1) is implementation-defined; we spec:
    // untimed lessons count with the average duration of timed lessons
    const percent = courseWatchPercent([
      { watchedSeconds: 300, durationSeconds: 600 },
      { watchedSeconds: 1, durationSeconds: 0 },
    ]);
    expect(percent).toBe(75);
  });

  it("caps overwatched lessons at their duration", () => {
    const percent = courseWatchPercent([
      { watchedSeconds: 10_000, durationSeconds: 600 },
      { watchedSeconds: 0, durationSeconds: 600 },
    ]);
    expect(percent).toBe(50);
  });

  it("rounds to at most two decimals", () => {
    const percent = courseWatchPercent([
      { watchedSeconds: 1, durationSeconds: 3 },
      { watchedSeconds: 0, durationSeconds: 0 },
    ]);
    expect(percent).toBe(Number(percent.toFixed(2)));
  });
});

describe("isEligibleForExam", () => {
  it("is eligible when watch percent meets the requirement and no section quizzes exist", () => {
    expect(
      isEligibleForExam({
        watchPercent: 80,
        requiredWatchPercent: 80,
        sectionQuizzesPassed: [],
      })
    ).toBe(true);
  });

  it("is not eligible below the required watch percent", () => {
    expect(
      isEligibleForExam({
        watchPercent: 79.9,
        requiredWatchPercent: 80,
        sectionQuizzesPassed: [],
      })
    ).toBe(false);
  });

  it("requires every section quiz to be passed", () => {
    expect(
      isEligibleForExam({
        watchPercent: 100,
        requiredWatchPercent: 80,
        sectionQuizzesPassed: [true, false],
      })
    ).toBe(false);
    expect(
      isEligibleForExam({
        watchPercent: 100,
        requiredWatchPercent: 80,
        sectionQuizzesPassed: [true, true],
      })
    ).toBe(true);
  });

  it("a requirement of 0 percent only requires section quizzes", () => {
    expect(
      isEligibleForExam({
        watchPercent: 0,
        requiredWatchPercent: 0,
        sectionQuizzesPassed: [],
      })
    ).toBe(true);
  });
});
