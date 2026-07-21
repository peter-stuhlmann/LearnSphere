import { describe, expect, it } from "vitest";
import { sectionExamResults } from "./verification";

const quizzes = [
  { id: "final", title: "Abschlussprüfung", kind: "FINAL" as const, passPercent: 70 },
  { id: "q1", title: "Zwischenprüfung 1", kind: "SECTION" as const, passPercent: 60 },
  { id: "q2", title: "Zwischenprüfung 2", kind: "SECTION" as const, passPercent: 80 },
];

describe("sectionExamResults", () => {
  it("liefert nur Zwischenprüfungen, in Quiz-Reihenfolge", () => {
    const results = sectionExamResults(quizzes, []);
    expect(results.map((r) => r.quizId)).toEqual(["q1", "q2"]);
    expect(results[0].title).toBe("Zwischenprüfung 1");
    expect(results[1].passPercent).toBe(80);
  });

  it("ohne Versuche: keine Quote, kein Datum, nicht bestanden", () => {
    const [r] = sectionExamResults(quizzes, []);
    expect(r.bestScorePercent).toBeNull();
    expect(r.passedAt).toBeNull();
    expect(r.passed).toBe(false);
  });

  it("Quote ist der beste Versuch, egal ob bestanden", () => {
    const results = sectionExamResults(quizzes, [
      { quizId: "q1", scorePercent: 55, passed: false, createdAt: new Date("2026-01-01") },
      { quizId: "q1", scorePercent: 90, passed: true, createdAt: new Date("2026-01-03") },
      { quizId: "q1", scorePercent: 70, passed: true, createdAt: new Date("2026-01-02") },
    ]);
    expect(results[0].bestScorePercent).toBe(90);
  });

  it("Abschlussdatum ist der früheste bestandene Versuch", () => {
    const results = sectionExamResults(quizzes, [
      { quizId: "q1", scorePercent: 55, passed: false, createdAt: new Date("2026-01-01") },
      { quizId: "q1", scorePercent: 70, passed: true, createdAt: new Date("2026-01-02") },
      { quizId: "q1", scorePercent: 90, passed: true, createdAt: new Date("2026-01-03") },
    ]);
    expect(results[0].passed).toBe(true);
    expect(results[0].passedAt).toEqual(new Date("2026-01-02"));
  });

  it("nicht bestandene Versuche liefern Quote, aber kein Abschlussdatum", () => {
    const results = sectionExamResults(quizzes, [
      { quizId: "q2", scorePercent: 42, passed: false, createdAt: new Date("2026-02-01") },
    ]);
    expect(results[1].bestScorePercent).toBe(42);
    expect(results[1].passed).toBe(false);
    expect(results[1].passedAt).toBeNull();
  });

  it("ordnet Versuche dem richtigen Quiz zu (Abschlussprüfung zählt nicht)", () => {
    const results = sectionExamResults(quizzes, [
      { quizId: "final", scorePercent: 99, passed: true, createdAt: new Date("2026-03-01") },
      { quizId: "q2", scorePercent: 85, passed: true, createdAt: new Date("2026-03-02") },
    ]);
    expect(results[0].bestScorePercent).toBeNull();
    expect(results[1].bestScorePercent).toBe(85);
  });
});
