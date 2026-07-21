import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt";

const chunks = [
  {
    sectionTitle: "Grundlagen",
    lessonTitle: "Die Sonne",
    text: "Grundlagen · Die Sonne\nDie Sonne ist ein Stern.",
  },
];

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt({
    courseTitle: "Sternenkunde",
    lang: "de",
    currentLessonTitle: "Die Sonne",
    chunks,
  });

  it("nennt Kurs, aktuelle Lektion und Antwortsprache", () => {
    expect(prompt).toContain("Sternenkunde");
    expect(prompt).toContain("Die Sonne");
    expect(prompt).toContain("Deutsch");
  });

  it("bettet die Auszüge mit Fundstellen ein", () => {
    expect(prompt).toContain("Die Sonne ist ein Stern.");
    expect(prompt).toContain("[Grundlagen · Die Sonne]");
  });

  it("enthält die Kernregeln: Ehrlichkeit, Markierung, kein Prüfungs-Leak", () => {
    expect(prompt).toMatch(/honest|weiß|do not know/i);
    expect(prompt).toMatch(/not part of the course/i);
    expect(prompt).toMatch(/exam/i);
  });

  it("unbekannte Sprache und fehlende Fundstellen-Titel fallen sauber zurück", () => {
    const exotic = buildSystemPrompt({
      courseTitle: "Sternenkunde",
      lang: "fr",
      currentLessonTitle: null,
      chunks: [{ sectionTitle: "", lessonTitle: "", text: "Kurs-Meta." }],
    });
    expect(exotic).toContain("Answer in fr");
    expect(exotic).toContain("[Kurs]");
  });

  it("ohne Auszüge: expliziter Hinweis, dass nichts gefunden wurde", () => {
    const empty = buildSystemPrompt({
      courseTitle: "Sternenkunde",
      lang: "en",
      currentLessonTitle: null,
      chunks: [],
    });
    expect(empty).toContain("No course excerpts matched");
    expect(empty).toContain("English");
  });
});
