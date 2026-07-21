import { describe, expect, it } from "vitest";
import {
  averageBestScores,
  buildDailySeries,
  completionRate,
  formatLearningTime,
  ratingDistribution,
  startDateForRange,
  STAT_RANGES,
} from "./stats";

const NOW = new Date("2026-07-07T12:00:00Z");

describe("startDateForRange", () => {
  it("computes the window start for day ranges", () => {
    expect(startDateForRange("7d", NOW)).toEqual(
      new Date("2026-06-30T12:00:00Z")
    );
    expect(startDateForRange("30d", NOW)).toEqual(
      new Date("2026-06-07T12:00:00Z")
    );
  });

  it("returns null for the all-time range", () => {
    expect(startDateForRange("all", NOW)).toBe(null);
  });

  it("exposes the supported ranges", () => {
    expect(STAT_RANGES).toEqual(["7d", "30d", "90d", "365d", "all"]);
  });
});

describe("buildDailySeries", () => {
  it("buckets events per day and fills gaps with zero", () => {
    const events = [
      { createdAt: new Date("2026-07-05T08:00:00Z"), value: 1000 },
      { createdAt: new Date("2026-07-05T20:00:00Z"), value: 500 },
      { createdAt: new Date("2026-07-07T01:00:00Z"), value: 200 },
    ];
    const series = buildDailySeries(
      events,
      new Date("2026-07-04T00:00:00Z"),
      new Date("2026-07-07T23:00:00Z")
    );
    expect(series).toEqual([
      { date: "2026-07-04", value: 0 },
      { date: "2026-07-05", value: 1500 },
      { date: "2026-07-06", value: 0 },
      { date: "2026-07-07", value: 200 },
    ]);
  });

  it("returns an empty array when from is after to", () => {
    expect(
      buildDailySeries([], new Date("2026-07-08"), new Date("2026-07-07"))
    ).toEqual([]);
  });
});

describe("averageBestScores", () => {
  it("uses only the best attempt per quiz", () => {
    const attempts = [
      { quizId: "a", scorePercent: 40 },
      { quizId: "a", scorePercent: 80 },
      { quizId: "b", scorePercent: 60 },
    ];
    // beste: a=80, b=60 → Ø 70
    expect(averageBestScores(attempts)).toBe(70);
  });

  it("returns null without attempts", () => {
    expect(averageBestScores([])).toBe(null);
  });

  it("rounds to one decimal", () => {
    const attempts = [
      { quizId: "a", scorePercent: 33.33 },
      { quizId: "b", scorePercent: 66.67 },
    ];
    expect(averageBestScores(attempts)).toBe(50);
  });
});

describe("completionRate", () => {
  it("computes the share of completed enrollments", () => {
    expect(
      completionRate([
        { completedAt: new Date() },
        { completedAt: null },
        { completedAt: new Date() },
        { completedAt: null },
      ])
    ).toBe(50);
  });

  it("returns null for no enrollments", () => {
    expect(completionRate([])).toBe(null);
  });
});

describe("ratingDistribution", () => {
  it("counts ratings into five buckets", () => {
    expect(ratingDistribution([5, 5, 4, 1, 3, 5])).toEqual([1, 0, 1, 1, 3]);
  });

  it("ignores out-of-range values", () => {
    expect(ratingDistribution([0, 6, 2])).toEqual([0, 1, 0, 0, 0]);
  });
});

describe("formatLearningTime", () => {
  it("formats minutes below an hour", () => {
    expect(formatLearningTime(59 * 60)).toBe("59 min");
  });

  it("formats hours and minutes", () => {
    expect(formatLearningTime(3 * 3600 + 25 * 60)).toBe("3 h 25 min");
  });

  it("formats zero", () => {
    expect(formatLearningTime(0)).toBe("0 min");
  });
});
