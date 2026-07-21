import { describe, expect, it } from "vitest";
import {
  courseSearchWhere,
  matchesCourseText,
  SEARCH_MIN_CHARS,
} from "./course-search";

describe("courseSearchWhere", () => {
  it("durchsucht Titel, Untertitel, Tags und Beschreibung", () => {
    expect(courseSearchWhere("Astro")).toEqual({
      OR: [
        { title: { contains: "Astro" } },
        { subtitle: { contains: "Astro" } },
        { tags: { contains: "astro" } },
        { description: { contains: "Astro" } },
      ],
    });
  });

  it("normalisiert den Tag-Anteil (Leerzeichen → Bindestrich)", () => {
    const where = courseSearchWhere("Machine Learning");
    expect(where.OR).toContainEqual({
      tags: { contains: "machine-learning" },
    });
  });
});

describe("matchesCourseText", () => {
  const course = {
    title: "HalloWelt-Kurs",
    subtitle: "Für Einsteiger",
    tags: "machine-learning,react",
    description: "<p>Wir lernen <strong>Sterne</strong> kennen.</p>",
  };

  it("matcht Substrings case-insensitiv in allen Feldern", () => {
    expect(matchesCourseText(course, "allo")).toBe(true); // Titel
    expect(matchesCourseText(course, "WEL")).toBe(true); // Titel, andere Schreibung
    expect(matchesCourseText(course, "einstei")).toBe(true); // Untertitel
    expect(matchesCourseText(course, "Machine Learning")).toBe(true); // Tag
    expect(matchesCourseText(course, "sterne")).toBe(true); // Beschreibung
  });

  it("matcht KEINE HTML-Tag-Namen der Beschreibung", () => {
    expect(matchesCourseText(course, "strong")).toBe(false);
    expect(matchesCourseText({ title: "X", description: "<p>Text</p>" }, "p>")).toBe(false);
  });

  it("behandelt fehlende Felder und leere Suche", () => {
    expect(matchesCourseText({ title: "Nur Titel" }, "titel")).toBe(true);
    expect(matchesCourseText({ title: "Nur Titel" }, "fehlt")).toBe(false);
    expect(matchesCourseText({ title: "X", description: null }, "abc")).toBe(
      false
    );
    expect(matchesCourseText(course, "   ")).toBe(false);
  });

  it("exportiert die Mindestlänge für Live-Suche", () => {
    expect(SEARCH_MIN_CHARS).toBe(3);
  });
});
