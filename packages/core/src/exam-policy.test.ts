import { describe, expect, it } from "vitest";
import { canAttemptQuiz, type QuizAttemptRecord } from "./exam-policy";

const NOW = new Date("2026-07-07T12:00:00Z");

function attempt(hoursAgo: number, passed = false): QuizAttemptRecord {
  return {
    createdAt: new Date(NOW.getTime() - hoursAgo * 3_600_000),
    passed,
  };
}

const UNLIMITED = {
  maxAttempts: null,
  attemptWindowHours: null,
  retakeAfterPass: true,
};

describe("canAttemptQuiz", () => {
  it("allows the first attempt with default policy", () => {
    expect(canAttemptQuiz({ attempts: [], policy: UNLIMITED, now: NOW })).toEqual({
      allowed: true,
    });
  });

  it("allows unlimited retries by default", () => {
    const attempts = [attempt(1), attempt(2), attempt(3, true)];
    expect(
      canAttemptQuiz({ attempts, policy: UNLIMITED, now: NOW }).allowed
    ).toBe(true);
  });

  it("blocks retake after pass when retakeAfterPass is false", () => {
    const result = canAttemptQuiz({
      attempts: [attempt(5, true)],
      policy: { ...UNLIMITED, retakeAfterPass: false },
      now: NOW,
    });
    expect(result).toEqual({ allowed: false, reason: "already_passed" });
  });

  it("still allows attempts after a fail when retakeAfterPass is false", () => {
    const result = canAttemptQuiz({
      attempts: [attempt(5, false)],
      policy: { ...UNLIMITED, retakeAfterPass: false },
      now: NOW,
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks permanently when all-time attempts are exhausted (no window)", () => {
    const result = canAttemptQuiz({
      attempts: [attempt(100), attempt(50)],
      policy: { maxAttempts: 2, attemptWindowHours: null, retakeAfterPass: true },
      now: NOW,
    });
    expect(result).toEqual({ allowed: false, reason: "attempts_exhausted" });
  });

  it("allows attempts below the all-time limit", () => {
    const result = canAttemptQuiz({
      attempts: [attempt(100)],
      policy: { maxAttempts: 2, attemptWindowHours: null, retakeAfterPass: true },
      now: NOW,
    });
    expect(result.allowed).toBe(true);
  });

  it("with a window, only attempts inside the window count", () => {
    const result = canAttemptQuiz({
      attempts: [attempt(30), attempt(26)], // beide außerhalb von 24h
      policy: { maxAttempts: 2, attemptWindowHours: 24, retakeAfterPass: true },
      now: NOW,
    });
    expect(result.allowed).toBe(true);
  });

  it("with a window, blocks until the oldest counted attempt leaves the window", () => {
    const result = canAttemptQuiz({
      attempts: [attempt(10), attempt(2)],
      policy: { maxAttempts: 2, attemptWindowHours: 24, retakeAfterPass: true },
      now: NOW,
    });
    if (result.allowed || result.reason !== "cooldown") {
      throw new Error(`expected cooldown, got ${JSON.stringify(result)}`);
    }
    // ältester Versuch im Fenster war vor 10h → frei nach weiteren 14h
    expect(result.nextAttemptAt).toEqual(
      new Date(NOW.getTime() + 14 * 3_600_000)
    );
  });

  it("already_passed wins over cooldown", () => {
    const result = canAttemptQuiz({
      attempts: [attempt(1, true), attempt(2)],
      policy: {
        maxAttempts: 2,
        attemptWindowHours: 24,
        retakeAfterPass: false,
      },
      now: NOW,
    });
    expect(result).toEqual({ allowed: false, reason: "already_passed" });
  });
});
