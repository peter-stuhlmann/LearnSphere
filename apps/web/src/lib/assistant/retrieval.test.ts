import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  keywordScore,
  queryTerms,
  rankChunks,
} from "./retrieval";

describe("cosineSimilarity", () => {
  it("1 für identische Richtung, 0 für orthogonal, -1 für entgegengesetzt", () => {
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 3])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("Nullvektoren ergeben 0 statt NaN", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it("rechnet auch mit Float32Array (so liegen Embeddings im Cache)", () => {
    expect(
      cosineSimilarity(Float32Array.from([1, 0]), Float32Array.from([3, 0]))
    ).toBeCloseTo(1);
  });
});

describe("queryTerms", () => {
  it("nimmt nur Wörter ab vier Zeichen und entdoppelt", () => {
    expect(queryTerms("Wie ist der Aufbau der Sonne, Sonne?")).toEqual([
      "aufbau",
      "sonne",
    ]);
  });

  it("kommt mit Satzzeichen und leerer Frage zurecht", () => {
    expect(queryTerms("...")).toEqual([]);
  });
});

describe("keywordScore", () => {
  it("misst den Anteil der gefundenen Begriffe", () => {
    expect(keywordScore("Die Sonne ist heiß", ["sonne", "aufbau"])).toBe(0.5);
  });

  it("ohne Suchbegriffe: 0 statt Division durch null", () => {
    expect(keywordScore("egal", [])).toBe(0);
  });
});

describe("rankChunks", () => {
  const chunk = (
    id: string,
    lessonId: string | null,
    embedding: number[],
    text = `Text ${id}`
  ) => ({ id, lessonId, embedding, text });

  const chunks = [
    chunk("a", "l1", [1, 0, 0]),
    chunk("b", "l2", [0.9, 0.1, 0]),
    chunk("c", "l2", [0, 1, 0]),
    chunk("d", null, [0, 0, 1]),
  ];

  it("sortiert nach Ähnlichkeit", () => {
    const ranked = rankChunks([1, 0, 0], chunks, { minScore: 0.5 });
    expect(ranked.map((r) => r.id)).toEqual(["a", "b"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("filtert Treffer unter der Mindest-Ähnlichkeit", () => {
    // b liegt bei ~0.994 – knapp unter der Schwelle
    const ranked = rankChunks([1, 0, 0], chunks, { minScore: 0.996 });
    expect(ranked.map((r) => r.id)).toEqual(["a"]);
  });

  it("bevorzugt Chunks der aktuellen Lektion (Bonus)", () => {
    // b (l2) ist knapp schlechter als a – der Lektions-Bonus dreht das um
    const ranked = rankChunks([1, 0, 0], chunks, {
      currentLessonId: "l2",
      lessonBonus: 0.2,
      minScore: 0.5,
    });
    expect(ranked[0].id).toBe("b");
  });

  it("hebt Wort-Treffer über die Schwelle (hybride Suche)", () => {
    /* Der Vektor passt kaum, aber der gesuchte Eigenname steht wörtlich
       drin – genau der Fall, für den Embeddings allein blind sind. */
    const withName = [chunk("x", "l1", [0, 0, 1], "Hirschbiegel führte Regie")];
    const ohne = rankChunks([1, 0, 0], withName, { minScore: 0.2 });
    expect(ohne).toEqual([]);

    const mit = rankChunks([1, 0, 0], withName, {
      minScore: 0.2,
      terms: ["hirschbiegel"],
      keywordWeight: 0.5,
    });
    expect(mit.map((r) => r.id)).toEqual(["x"]);
  });

  it("verteilt das Budget über Lektionen statt es einer zu überlassen", () => {
    const many = [
      chunk("l1-1", "l1", [1, 0, 0]),
      chunk("l1-2", "l1", [0.99, 0.01, 0]),
      chunk("l1-3", "l1", [0.98, 0.02, 0]),
      chunk("l2-1", "l2", [0.9, 0.1, 0]),
    ];
    const ranked = rankChunks([1, 0, 0], many, {
      perLessonCap: 2,
      minScore: 0.5,
    });
    // erste Runde: 2× l1, 1× l2 – danach füllt Runde zwei den Rest auf
    expect(ranked.slice(0, 3).map((r) => r.id)).toEqual([
      "l1-1",
      "l1-2",
      "l2-1",
    ]);
    expect(ranked).toHaveLength(4);
  });

  it("hält das Zeichenbudget ein", () => {
    const long = [
      chunk("gross", "l1", [1, 0, 0], "x".repeat(300)),
      chunk("klein", "l2", [0.9, 0.1, 0], "y".repeat(50)),
    ];
    const ranked = rankChunks([1, 0, 0], long, {
      charBudget: 100,
      minScore: 0.5,
    });
    // der große Auszug passt nicht ins Budget, der kleine schon
    expect(ranked.map((r) => r.id)).toEqual(["klein"]);
  });

  it("nimmt auch Kurs-Meta ohne Lektion auf", () => {
    // Kurs-Meta hat keine lessonId - es darf trotzdem nicht durchfallen
    const meta = [chunk("meta", null, [1, 0, 0], "Kursbeschreibung")];
    const ranked = rankChunks([1, 0, 0], meta, { minScore: 0.5 });
    expect(ranked.map((r) => r.id)).toEqual(["meta"]);
  });

  it("leere Kandidatenliste ergibt leeres Ergebnis", () => {
    expect(rankChunks([1, 0], [], {})).toEqual([]);
  });
});
