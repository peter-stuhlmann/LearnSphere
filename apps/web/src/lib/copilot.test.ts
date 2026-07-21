import { describe, expect, it } from "vitest";
import {
  buildFieldPrompt,
  buildImprovePrompt,
  COPILOT_FIELDS,
  COPILOT_MAX_TOKENS,
  COPILOT_STUDY_LIMIT,
  IMPROVE_MAX_CHARS,
  paragraphsToHtml,
  parseFieldResponse,
  parseImproveResponse,
} from "./copilot";

describe("buildFieldPrompt", () => {
  it("baut je Feld einen gezielten Prompt (de/en) und deckelt den Inhalt", () => {
    for (const field of COPILOT_FIELDS) {
      const de = buildFieldPrompt(field, {
        courseTitle: "React",
        studyText: "Inhalt",
        lang: "de",
      });
      expect(de).toContain('"value"');
      expect(de).toContain("Kursinhalte:");
      expect(COPILOT_MAX_TOKENS[field]).toBeGreaterThan(0);

      const en = buildFieldPrompt(field, {
        courseTitle: "React",
        studyText: "Content",
        lang: "en",
      });
      expect(en).toContain("Course content:");
    }

    const long = buildFieldPrompt("title", {
      courseTitle: "X",
      studyText: "a".repeat(COPILOT_STUDY_LIMIT + 5_000),
      lang: "de",
    });
    expect(long.length).toBeLessThan(COPILOT_STUDY_LIMIT + 1_000);
  });
});

describe("parseFieldResponse", () => {
  it("parst gültige Antworten je Feld", () => {
    expect(
      parseFieldResponse("title", '{"value":"React für Einsteiger"}')
    ).toBe("React für Einsteiger");
    expect(
      parseFieldResponse("subtitle", '{"value":"Von null auf produktionsreif"}')
    ).toBe("Von null auf produktionsreif");
    expect(
      parseFieldResponse(
        "description",
        '{"value":["In diesem Kurs lernst du die Grundlagen von React kennen.","Am Ende baust du deine eigene kleine App komplett selbst."]}'
      )
    ).toEqual([
      "In diesem Kurs lernst du die Grundlagen von React kennen.",
      "Am Ende baust du deine eigene kleine App komplett selbst.",
    ]);
    expect(
      parseFieldResponse("tags", '{"value":["react","hooks","frontend"]}')
    ).toEqual(["react", "hooks", "frontend"]);
  });

  it("entfernt Markdown-Zäune", () => {
    expect(
      parseFieldResponse("title", '```json\n{"value":"Mit Zaun"}\n```')
    ).toBe("Mit Zaun");
  });

  it("lehnt falsche Formen und kaputtes JSON ab", () => {
    // String statt Array
    expect(parseFieldResponse("tags", '{"value":"react"}')).toBeNull();
    // Array statt String
    expect(parseFieldResponse("title", '{"value":["a","b","c"]}')).toBeNull();
    // zu kurz / zu wenige Einträge
    expect(parseFieldResponse("subtitle", '{"value":"kurz"}')).toBeNull();
    expect(parseFieldResponse("tags", '{"value":["nur","zwei"]}')).toBeNull();
    expect(parseFieldResponse("title", "kein json")).toBeNull();
  });
});

describe("Improve (Bubble-Menü)", () => {
  it("baut den Verbesserungs-Prompt (de/en) und deckelt die Länge", () => {
    const de = buildImprovePrompt({ text: "Der text ist okey.", lang: "de" });
    expect(de).toContain("Verbessere");
    expect(buildImprovePrompt({ text: "x", lang: "en" })).toContain("Improve");
    const long = buildImprovePrompt({
      text: "a".repeat(IMPROVE_MAX_CHARS + 2_000),
      lang: "de",
    });
    expect(long.length).toBeLessThan(IMPROVE_MAX_CHARS + 500);
  });

  it("parst die Verbesserungs-Antwort", () => {
    expect(parseImproveResponse('{"value":"Der Text ist okay."}')).toBe(
      "Der Text ist okay."
    );
    expect(parseImproveResponse('```json\n{"value":"Ok."}\n```')).toBe("Ok.");
    expect(parseImproveResponse('{"value":""}')).toBeNull();
    expect(parseImproveResponse("kaputt")).toBeNull();
  });
});

describe("paragraphsToHtml", () => {
  it("escaped HTML und baut <p>-Absätze", () => {
    expect(paragraphsToHtml(["Hallo <b>Welt</b>", "A & B"])).toBe(
      "<p>Hallo &lt;b&gt;Welt&lt;/b&gt;</p><p>A &amp; B</p>"
    );
  });
});
