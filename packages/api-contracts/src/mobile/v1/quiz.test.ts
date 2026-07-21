import { describe, expect, it } from "vitest";
import {
  attemptStateSchema,
  certificateItemSchema,
  quizForAttemptSchema,
  quizSubmitRequestSchema,
  quizSubmitResponseSchema,
} from "./quiz";

describe("quiz contracts", () => {
  it("validiert die Prüfung zum Bearbeiten", () => {
    expect(
      quizForAttemptSchema.safeParse({
        quiz: {
          id: "q1",
          courseId: "c1",
          kind: "FINAL",
          title: "Abschluss",
          passPercent: 70,
          timeLimitMinutes: 30,
          remainingSeconds: 1799,
        },
        attempt: {
          allowed: true,
          reason: null,
          nextAttemptAt: null,
          attemptsUsed: 1,
          maxAttempts: 3,
        },
        questions: [
          {
            id: "f1",
            text: "2+2?",
            kind: "SINGLE",
            points: 1,
            options: [
              { id: "o1", text: "4" },
              { id: "o2", text: "5" },
            ],
          },
        ],
      }).success
    ).toBe(true);
  });

  it("kennt die Sperr-Zustände", () => {
    expect(
      attemptStateSchema.safeParse({
        allowed: false,
        reason: "cooldown",
        nextAttemptAt: "2026-07-15T00:00:00.000Z",
        attemptsUsed: 3,
        maxAttempts: 3,
      }).success
    ).toBe(true);
    expect(
      attemptStateSchema.safeParse({
        allowed: false,
        reason: "unbekannt",
        nextAttemptAt: null,
        attemptsUsed: 0,
        maxAttempts: null,
      }).success
    ).toBe(false);
  });

  it("begrenzt Abgaben (max 2000 Zeichen, max 50 Antworten)", () => {
    expect(
      quizSubmitRequestSchema.safeParse({ answers: { f1: ["o1"] } }).success
    ).toBe(true);
    expect(
      quizSubmitRequestSchema.safeParse({
        answers: { f1: ["x".repeat(2001)] },
      }).success
    ).toBe(false);
  });

  it("validiert Ergebnis und Zertifikatsliste", () => {
    expect(
      quizSubmitResponseSchema.safeParse({
        scorePercent: 85,
        passed: true,
        certificateSerial: "LS-2026-ABCD",
        earnedPoints: 17,
        totalPoints: 20,
        perQuestion: [{ questionId: "f1", correct: true, points: 1 }],
      }).success
    ).toBe(true);
    expect(
      certificateItemSchema.safeParse({
        serial: "LS-2026-ABCD",
        courseTitle: "Kurs",
        scorePercent: 85,
        issuedAt: "2026-07-14T00:00:00.000Z",
      }).success
    ).toBe(true);
  });
});
