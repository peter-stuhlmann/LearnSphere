import { describe, expect, it } from "vitest";
import {
  checkCoursePublish,
  countWords,
  examHasValidQuestion,
  isValidExamQuestion,
  PUBLISH_MIN_DESCRIPTION_WORDS,
  type PublishCheckInput,
} from "./course-publish";

describe("countWords", () => {
  it("zählt Wörter und ignoriert HTML/Entities", () => {
    expect(countWords(undefined as unknown as string)).toBe(0);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("eins zwei drei")).toBe(3);
    expect(countWords("<p>eins <b>zwei</b></p>")).toBe(2);
    expect(countWords("a&nbsp;b")).toBe(2);
  });
});

describe("isValidExamQuestion / examHasValidQuestion", () => {
  it("Single/Multiple brauchen ≥1 richtige Option", () => {
    expect(isValidExamQuestion({ kind: "SINGLE", correctOptionCount: 0 })).toBe(false);
    expect(isValidExamQuestion({ kind: "SINGLE", correctOptionCount: 1 })).toBe(true);
    expect(isValidExamQuestion({ kind: "MULTIPLE", correctOptionCount: 2 })).toBe(true);
  });

  it("Freitext: KI-bewertet oder mit Musterlösung", () => {
    expect(
      isValidExamQuestion({ kind: "FREE_TEXT", correctOptionCount: 0 })
    ).toBe(false);
    expect(
      isValidExamQuestion({ kind: "FREE_TEXT", correctOptionCount: 0, aiGraded: true })
    ).toBe(true);
    expect(
      isValidExamQuestion({
        kind: "FREE_TEXT",
        correctOptionCount: 0,
        expectedAnswer: "42",
      })
    ).toBe(true);
    expect(
      isValidExamQuestion({
        kind: "FREE_TEXT",
        correctOptionCount: 0,
        expectedAnswer: "   ",
      })
    ).toBe(false);
  });

  it("examHasValidQuestion prüft die Liste", () => {
    expect(examHasValidQuestion([])).toBe(false);
    expect(
      examHasValidQuestion([
        { kind: "SINGLE", correctOptionCount: 0 },
        { kind: "MULTIPLE", correctOptionCount: 1 },
      ])
    ).toBe(true);
  });
});

describe("checkCoursePublish", () => {
  const words = Array.from(
    { length: PUBLISH_MIN_DESCRIPTION_WORDS },
    (_, i) => `wort${i}`
  ).join(" ");

  const complete: PublishCheckInput = {
    title: "Mein Kurs",
    description: words,
    category: "programming",
    finalExamRequired: true,
    hasValidFinalExam: true,
    coverImage: "/uploads/x.jpg",
    subtitle: "Ein Untertitel",
    tagCount: 3,
  };

  it("keine Blocker/Warnungen bei vollständigem Kurs", () => {
    const result = checkCoursePublish(complete);
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("meldet fehlenden Titel, zu kurze Beschreibung, keine Kategorie", () => {
    const result = checkCoursePublish({
      ...complete,
      title: "  ",
      description: "nur drei wörter",
      category: null,
    });
    expect(result.blockers).toContain("title");
    expect(result.blockers).toContain("description");
    expect(result.blockers).toContain("category");
  });

  it("Beschreibung genau an der Grenze ist gültig", () => {
    expect(checkCoursePublish(complete).blockers).not.toContain("description");
    expect(
      checkCoursePublish({
        ...complete,
        description: words.split(" ").slice(0, -1).join(" "),
      }).blockers
    ).toContain("description");
  });

  it("Abschlussprüfung nur Blocker, wenn erforderlich UND ungültig", () => {
    expect(
      checkCoursePublish({ ...complete, hasValidFinalExam: false }).blockers
    ).toContain("finalExam");
    expect(
      checkCoursePublish({
        ...complete,
        finalExamRequired: false,
        hasValidFinalExam: false,
      }).blockers
    ).not.toContain("finalExam");
  });

  it("Bild/Untertitel/Tags sind nur Warnungen", () => {
    const result = checkCoursePublish({
      ...complete,
      coverImage: null,
      subtitle: "",
      tagCount: 0,
    });
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual(["coverImage", "subtitle", "tags"]);
  });
});
