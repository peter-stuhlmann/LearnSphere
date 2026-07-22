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
    // Ergänzendes Wissen muss als solches gekennzeichnet werden
    expect(prompt).toMatch(/steht so nicht im Kurs/i);
    expect(prompt).toMatch(/exam/i);
  });

  it("erlaubt ausdrücklich Fachwissen zum Kursthema", () => {
    /* Ohne diese Erlaubnis wich das Modell auf "steht nicht im Kurs" aus,
       auch wenn die Frage dem Kursthema galt (z. B. Filminhalt in einem
       Filmkurs). Die Regel ist der Kern der Antwortqualität. */
    expect(prompt).toMatch(/general knowledge/i);
    expect(prompt).toMatch(/Do NOT refuse a subject question/i);
  });

  it("bettet die Landkarte ein und weist auf ihre Verdichtung hin", () => {
    const withMap = buildSystemPrompt({
      courseTitle: "Sternenkunde",
      lang: "de",
      currentLessonTitle: null,
      courseMap: "## Grundlagen\n### Die Sonne\nEin Stern.",
      chunks,
    });
    expect(withMap).toContain("COURSE MAP");
    expect(withMap).toContain("### Die Sonne");
    // Verdichtet: das Modell darf sie nicht als Wortlaut zitieren
    expect(withMap).toMatch(/do not quote it as the course/i);
  });

  it("leere Landkarte wird weggelassen statt leer eingebettet", () => {
    const noMap = buildSystemPrompt({
      courseTitle: "Sternenkunde",
      lang: "de",
      currentLessonTitle: null,
      courseMap: "   ",
      chunks,
    });
    expect(noMap).not.toContain("COURSE MAP");
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
