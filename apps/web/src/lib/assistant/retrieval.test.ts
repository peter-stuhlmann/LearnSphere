import { describe, expect, it } from "vitest";
import { cosineSimilarity, rankChunks } from "./retrieval";

describe("cosineSimilarity", () => {
  it("1 für identische Richtung, 0 für orthogonal, -1 für entgegengesetzt", () => {
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 3])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("Nullvektoren ergeben 0 statt NaN", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe("rankChunks", () => {
  const chunks = [
    { id: "a", lessonId: "l1", embedding: [1, 0, 0] },
    { id: "b", lessonId: "l2", embedding: [0.9, 0.1, 0] },
    { id: "c", lessonId: "l2", embedding: [0, 1, 0] },
    { id: "d", lessonId: null, embedding: [0, 0, 1] },
  ];

  it("sortiert nach Ähnlichkeit und schneidet bei topK ab", () => {
    const ranked = rankChunks([1, 0, 0], chunks, { topK: 2 });
    expect(ranked.map((r) => r.id)).toEqual(["a", "b"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("filtert Treffer unter der Mindest-Ähnlichkeit", () => {
    const ranked = rankChunks([1, 0, 0], chunks, { topK: 10, minScore: 0.5 });
    expect(ranked.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("bevorzugt Chunks der aktuellen Lektion (Bonus)", () => {
    // b (l2) ist knapp schlechter als a – der Lektions-Bonus dreht das um
    const ranked = rankChunks([1, 0, 0], chunks, {
      topK: 2,
      currentLessonId: "l2",
      lessonBonus: 0.2,
    });
    expect(ranked[0].id).toBe("b");
  });

  it("leere Kandidatenliste ergibt leeres Ergebnis", () => {
    expect(rankChunks([1, 0], [], {})).toEqual([]);
  });
});
