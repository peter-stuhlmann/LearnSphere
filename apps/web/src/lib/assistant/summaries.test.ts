import { describe, expect, it } from "vitest";
import {
  buildCourseMap,
  buildSummaryPrompt,
  collectSummarySources,
  summaryHash,
  SUMMARY_MODEL,
  type SummarySourceChunk,
} from "./summaries";

const chunks: SummarySourceChunk[] = [
  {
    lang: "de",
    sectionId: "s1",
    lessonId: "l1",
    sectionTitle: "Grundlagen",
    lessonTitle: "Die Sonne",
    text: "Die Sonne ist ein Stern.",
  },
  {
    lang: "de",
    sectionId: "s1",
    lessonId: "l1",
    sectionTitle: "Grundlagen",
    lessonTitle: "Die Sonne",
    text: "Sie besteht aus Wasserstoff.",
  },
  {
    lang: "de",
    sectionId: "s1",
    lessonId: "l2",
    sectionTitle: "Grundlagen",
    lessonTitle: "Der Mond",
    text: "Der Mond umkreist die Erde.",
  },
  {
    lang: "en",
    sectionId: "s1",
    lessonId: "l1",
    sectionTitle: "Basics",
    lessonTitle: "The Sun",
    text: "The sun is a star.",
  },
  // Kurs-Meta hat keine Lektion und gehört nicht in die Landkarte
  {
    lang: "de",
    sectionId: null,
    lessonId: null,
    sectionTitle: "",
    lessonTitle: "",
    text: "Sternenkunde",
  },
];

describe("collectSummarySources", () => {
  const sources = collectSummarySources(chunks);

  it("bündelt je Lektion und Sprache genau eine Quelle", () => {
    expect(sources).toHaveLength(3);
    const de1 = sources.find((s) => s.lang === "de" && s.lessonId === "l1");
    expect(de1?.text).toBe("Die Sonne ist ein Stern.\n\nSie besteht aus Wasserstoff.");
  });

  it("lässt Kurs-Meta ohne Lektion aus", () => {
    expect(sources.every((s) => s.lessonId)).toBe(true);
  });

  it("hält die Kursreihenfolge fest – über Sprachen hinweg gleich", () => {
    expect(sources.find((s) => s.lessonId === "l1")?.order).toBe(0);
    expect(sources.find((s) => s.lessonId === "l2")?.order).toBe(1);
    const en = sources.find((s) => s.lang === "en");
    expect(en?.order).toBe(0);
  });

  it("kommt mit einer Lektion ohne Abschnitts-Id zurecht", () => {
    const ohne = collectSummarySources([{ ...chunks[0], sectionId: null }]);
    expect(ohne[0].sectionId).toBe("");
  });

  it("kürzt sehr lange Lektionen auf das Quellbudget", () => {
    const long = collectSummarySources(
      [{ ...chunks[0], text: "x".repeat(500) }],
      100
    );
    expect(long[0].text).toHaveLength(100);
  });

  it("gleicher Inhalt ergibt gleichen Hash, anderer nicht", () => {
    const again = collectSummarySources(chunks);
    expect(again[0].sourceHash).toBe(sources[0].sourceHash);
    expect(sources[0].sourceHash).not.toBe(sources[1].sourceHash);
    expect(summaryHash(SUMMARY_MODEL, "a")).not.toBe(
      summaryHash(SUMMARY_MODEL, "b")
    );
  });
});

describe("buildSummaryPrompt", () => {
  it("nennt Lektion, Abschnitt und verbietet Erfundenes", () => {
    const prompt = buildSummaryPrompt(collectSummarySources(chunks)[0]);
    expect(prompt).toContain("Die Sonne");
    expect(prompt).toContain("Grundlagen");
    expect(prompt).toMatch(/ONLY what the material below says/);
    expect(prompt).toContain("Die Sonne ist ein Stern.");
  });
});

describe("buildCourseMap", () => {
  const rows = [
    { sectionTitle: "Grundlagen", lessonTitle: "Die Sonne", order: 0, text: "Über die Sonne." },
    { sectionTitle: "Grundlagen", lessonTitle: "Der Mond", order: 1, text: "Über den Mond." },
    { sectionTitle: "Vertiefung", lessonTitle: "Planeten", order: 2, text: "Über Planeten." },
  ];

  it("gliedert nach Abschnitten in Kursreihenfolge", () => {
    const map = buildCourseMap(rows);
    expect(map.indexOf("## Grundlagen")).toBeLessThan(map.indexOf("## Vertiefung"));
    // Abschnittsüberschrift steht nur einmal
    expect(map.match(/## Grundlagen/g)).toHaveLength(1);
    expect(map).toContain("### Der Mond");
  });

  it("sortiert unabhängig von der Eingabereihenfolge", () => {
    const map = buildCourseMap([...rows].reverse());
    expect(map.indexOf("Die Sonne")).toBeLessThan(map.indexOf("Planeten"));
  });

  it("kürzt und sagt es dazu, statt still wegzulassen", () => {
    const map = buildCourseMap(rows, 60);
    expect(map).toMatch(/passen nicht in diese Übersicht/);
  });

  it("ohne Zusammenfassungen bleibt die Landkarte leer", () => {
    expect(buildCourseMap([])).toBe("");
  });
});
