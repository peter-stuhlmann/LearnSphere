import { describe, expect, it } from "vitest";
import {
  gradeQuiz,
  hasPassed,
  normalizeFreeText,
  type GradableQuestion,
} from "./grading";

const questions: GradableQuestion[] = [
  {
    id: "q1",
    kind: "SINGLE",
    options: [
      { id: "a", isCorrect: true },
      { id: "b", isCorrect: false },
    ],
  },
  {
    id: "q2",
    kind: "MULTIPLE",
    options: [
      { id: "c", isCorrect: true },
      { id: "d", isCorrect: true },
      { id: "e", isCorrect: false },
    ],
  },
];

describe("gradeQuiz", () => {
  it("gives full score for all-correct answers", () => {
    const result = gradeQuiz(questions, { q1: ["a"], q2: ["c", "d"] });
    expect(result.scorePercent).toBe(100);
    expect(result.correctCount).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it("scores 50 percent when one of two questions is correct", () => {
    const result = gradeQuiz(questions, { q1: ["a"], q2: ["c"] });
    expect(result.scorePercent).toBe(50);
    expect(result.correctCount).toBe(1);
  });

  it("requires the exact answer set for multiple-choice questions", () => {
    // selecting a wrong option in addition to the right ones fails the question
    const result = gradeQuiz(questions, { q1: ["a"], q2: ["c", "d", "e"] });
    expect(result.correctCount).toBe(1);
  });

  it("treats missing answers as wrong", () => {
    const result = gradeQuiz(questions, {});
    expect(result.scorePercent).toBe(0);
  });

  it("ignores answers for unknown questions", () => {
    const result = gradeQuiz(questions, {
      q1: ["a"],
      q2: ["c", "d"],
      ghost: ["x"],
    });
    expect(result.scorePercent).toBe(100);
  });

  it("answer order does not matter", () => {
    const result = gradeQuiz(questions, { q1: ["a"], q2: ["d", "c"] });
    expect(result.scorePercent).toBe(100);
  });

  it("duplicate selections count once", () => {
    const result = gradeQuiz(questions, { q1: ["a", "a"], q2: ["c", "d"] });
    expect(result.scorePercent).toBe(100);
  });

  it("returns 100 for an empty quiz", () => {
    const result = gradeQuiz([], {});
    expect(result.scorePercent).toBe(100);
    expect(result.totalCount).toBe(0);
  });

  it("rounds scores to two decimals", () => {
    const three: GradableQuestion[] = [
      ...questions,
      {
        id: "q3",
        kind: "SINGLE",
        options: [{ id: "f", isCorrect: true }],
      },
    ];
    const result = gradeQuiz(three, { q1: ["a"] });
    expect(result.scorePercent).toBe(33.33);
  });

  it("per-question results are reported", () => {
    const result = gradeQuiz(questions, { q1: ["b"], q2: ["c", "d"] });
    expect(result.perQuestion).toEqual([
      { questionId: "q1", correct: false, points: 1 },
      { questionId: "q2", correct: true, points: 1 },
    ]);
  });
});

describe("gradeQuiz mit gewichteten Punkten", () => {
  const weighted: GradableQuestion[] = [
    {
      id: "w1",
      kind: "SINGLE",
      points: 3,
      options: [{ id: "a", isCorrect: true }],
    },
    {
      id: "w2",
      kind: "SINGLE",
      points: 1,
      options: [{ id: "b", isCorrect: true }],
    },
  ];

  it("gewichtet die Quote nach Punkten", () => {
    const result = gradeQuiz(weighted, { w1: ["a"] });
    expect(result.scorePercent).toBe(75);
    expect(result.earnedPoints).toBe(3);
    expect(result.totalPoints).toBe(4);
    expect(result.correctCount).toBe(1);
  });

  it("ohne Punktangabe zählt jede Frage 1 Punkt", () => {
    const result = gradeQuiz(questions, { q1: ["a"] });
    expect(result.totalPoints).toBe(2);
    expect(result.earnedPoints).toBe(1);
    expect(result.scorePercent).toBe(50);
  });

  it("ungültige Punktwerte (0, negativ, krumm) zählen als mindestens 1", () => {
    const broken: GradableQuestion[] = [
      {
        id: "x",
        kind: "SINGLE",
        points: 0,
        options: [{ id: "a", isCorrect: true }],
      },
      {
        id: "y",
        kind: "SINGLE",
        points: -5,
        options: [{ id: "b", isCorrect: true }],
      },
    ];
    const result = gradeQuiz(broken, { x: ["a"] });
    expect(result.totalPoints).toBe(2);
    expect(result.scorePercent).toBe(50);
  });

  it("meldet die Punkte je Frage", () => {
    const result = gradeQuiz(weighted, { w1: ["a"] });
    expect(result.perQuestion).toEqual([
      { questionId: "w1", correct: true, points: 3 },
      { questionId: "w2", correct: false, points: 1 },
    ]);
  });

  it("leeres Quiz hat 0 Punkte und gilt als bestanden", () => {
    const result = gradeQuiz([], {});
    expect(result.totalPoints).toBe(0);
    expect(result.earnedPoints).toBe(0);
    expect(result.scorePercent).toBe(100);
  });
});

describe("normalizeFreeText", () => {
  it("trims, collapses whitespace and lowercases", () => {
    expect(normalizeFreeText("  Der  HOBBIT \n heißt Bilbo ")).toBe(
      "der hobbit heißt bilbo"
    );
  });

  it("keeps punctuation", () => {
    expect(normalizeFreeText("3,14!")).toBe("3,14!");
  });
});

describe("gradeQuiz with free-text questions", () => {
  const freeText: GradableQuestion = {
    id: "ft1",
    kind: "FREE_TEXT",
    options: [],
    expectedAnswer: "Bilbo Beutlin",
    aiGraded: false,
  };

  it("accepts an exact match ignoring case and extra whitespace", () => {
    const result = gradeQuiz([freeText], { ft1: ["  bilbo   beutlin "] });
    expect(result.scorePercent).toBe(100);
  });

  it("rejects a different answer in exact mode", () => {
    const result = gradeQuiz([freeText], { ft1: ["Frodo Beutlin"] });
    expect(result.scorePercent).toBe(0);
  });

  it("treats a missing free-text answer as wrong", () => {
    const result = gradeQuiz([freeText], {});
    expect(result.scorePercent).toBe(0);
  });

  it("is wrong when no expected answer is configured", () => {
    const broken: GradableQuestion = { ...freeText, expectedAnswer: null };
    const result = gradeQuiz([broken], { ft1: ["egal"] });
    expect(result.scorePercent).toBe(0);
  });

  it("uses the AI verdict for AI-graded questions", () => {
    const aiQuestion: GradableQuestion = { ...freeText, aiGraded: true };
    const wrong = gradeQuiz([aiQuestion], { ft1: ["Der Halbling aus Beutelsend"] });
    expect(wrong.scorePercent).toBe(0);
    const right = gradeQuiz(
      [aiQuestion],
      { ft1: ["Der Halbling aus Beutelsend"] },
      { ft1: true }
    );
    expect(right.scorePercent).toBe(100);
    const rejected = gradeQuiz(
      [aiQuestion],
      { ft1: ["Sauron"] },
      { ft1: false }
    );
    expect(rejected.scorePercent).toBe(0);
  });

  it("falls back to exact matching when no AI verdict exists", () => {
    const aiQuestion: GradableQuestion = { ...freeText, aiGraded: true };
    const result = gradeQuiz([aiQuestion], { ft1: ["bilbo beutlin"] });
    expect(result.scorePercent).toBe(100);
  });

  it("mixes choice and free-text questions", () => {
    const result = gradeQuiz(
      [...questions, freeText],
      { q1: ["a"], q2: ["c", "d"], ft1: ["falsch"] }
    );
    expect(result.correctCount).toBe(2);
    expect(result.totalCount).toBe(3);
  });
});

describe("hasPassed", () => {
  it("passes exactly at the threshold", () => {
    expect(hasPassed(70, 70)).toBe(true);
  });

  it("fails below the threshold", () => {
    expect(hasPassed(69.99, 70)).toBe(false);
  });

  it("a threshold of 0 always passes", () => {
    expect(hasPassed(0, 0)).toBe(true);
  });
});
