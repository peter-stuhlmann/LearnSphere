import { describe, expect, it } from "vitest";
import {
  biggestDrop,
  lessonFunnel,
  quizPassStats,
  retentionCurve,
} from "./course-analytics";

describe("lessonFunnel", () => {
  const lessons = [
    { lessonId: "l1", title: "Intro" },
    { lessonId: "l2", title: "Deep dive" },
  ];

  it("counts started and completed learners per lesson", () => {
    const funnel = lessonFunnel(
      lessons,
      [
        { lessonId: "l1", watchedSeconds: 100, completed: true },
        { lessonId: "l1", watchedSeconds: 20, completed: false },
        { lessonId: "l2", watchedSeconds: 0, completed: false },
      ],
      4
    );
    expect(funnel[0]).toEqual({
      lessonId: "l1",
      title: "Intro",
      started: 2,
      completed: 1,
      completionPercent: 25,
    });
    // opened but never watched → not started
    expect(funnel[1].started).toBe(0);
  });

  it("counts force-completed lessons without watch time as started", () => {
    const funnel = lessonFunnel(
      [lessons[0]],
      [{ lessonId: "l1", watchedSeconds: 0, completed: true }],
      1
    );
    expect(funnel[0].started).toBe(1);
    expect(funnel[0].completionPercent).toBe(100);
  });

  it("handles courses without enrollments", () => {
    const funnel = lessonFunnel([lessons[0]], [], 0);
    expect(funnel[0].completionPercent).toBe(0);
  });
});

describe("quizPassStats", () => {
  it("aggregates per participant with best score and pass flag", () => {
    const stats = quizPassStats(
      ["q1"],
      [
        { quizId: "q1", enrollmentId: "e1", scorePercent: 40, passed: false },
        { quizId: "q1", enrollmentId: "e1", scorePercent: 80, passed: true },
        { quizId: "q1", enrollmentId: "e2", scorePercent: 50, passed: false },
      ]
    );
    expect(stats[0]).toEqual({
      quizId: "q1",
      attempts: 3,
      participants: 2,
      passedParticipants: 1,
      passRatePercent: 50,
      averageBestScore: 65,
    });
  });

  it("returns zeros for quizzes without attempts", () => {
    const stats = quizPassStats(["q1"], []);
    expect(stats[0].participants).toBe(0);
    expect(stats[0].passRatePercent).toBe(0);
    expect(stats[0].averageBestScore).toBe(0);
  });

  it("rounds the average best score to one decimal", () => {
    const stats = quizPassStats(
      ["q1"],
      [
        { quizId: "q1", enrollmentId: "e1", scorePercent: 33.33, passed: false },
        { quizId: "q1", enrollmentId: "e2", scorePercent: 66.67, passed: true },
      ]
    );
    expect(stats[0].averageBestScore).toBe(50);
  });
});

describe("retentionCurve", () => {
  it("normalizes views relative to the maximum", () => {
    const curve = retentionCurve(
      [
        { bucket: 0, views: 10 },
        { bucket: 1, views: 5 },
      ],
      4
    );
    expect(curve).toEqual([1, 0.5, 0, 0]);
  });

  it("ignores out-of-range buckets", () => {
    const curve = retentionCurve(
      [
        { bucket: 0, views: 4 },
        { bucket: 9, views: 4 },
        { bucket: -1, views: 4 },
      ],
      2
    );
    expect(curve).toEqual([1, 0]);
  });

  it("returns null without any views", () => {
    expect(retentionCurve([], 4)).toBeNull();
    expect(retentionCurve([{ bucket: 0, views: 0 }], 4)).toBeNull();
  });
});

describe("biggestDrop", () => {
  it("finds the steepest decline", () => {
    expect(biggestDrop([1, 0.9, 0.4, 0.35])).toEqual({
      bucket: 1,
      drop: 0.5,
    });
  });

  it("ignores rises and flat curves", () => {
    expect(biggestDrop([0.5, 0.8, 1])).toBeNull();
    expect(biggestDrop([1, 1, 1])).toBeNull();
  });

  it("ignores insignificant drops below 10 points", () => {
    expect(biggestDrop([1, 0.95, 0.91])).toBeNull();
  });

  it("handles single-bucket curves", () => {
    expect(biggestDrop([1])).toBeNull();
  });
});
