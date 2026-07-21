import { describe, expect, it } from "vitest";
import {
  buildSelfTestPrompt,
  hasSelfTestContent,
  lessonStudyText,
  parseSelfTestOptions,
  parseSelfTestResponse,
  selfTestContentHash,
  SELF_TEST_MIN_CHARS,
  SELF_TEST_QUESTION_COUNT,
} from "./self-test";

const QUESTION = {
  prompt: "Was umkreist die Erde?",
  options: [
    { text: "Der Mond", correct: true },
    { text: "Die Sonne", correct: false },
    { text: "Mars", correct: false },
    { text: "Venus", correct: false },
  ],
  explanation: "Der Mond ist der natürliche Satellit der Erde.",
};

describe("lessonStudyText", () => {
  const blocks = [
    { type: "TEXT", content: "<p>Die <strong>Sonne</strong> ist ein Stern.</p>" },
    {
      type: "VIDEO",
      transcriptDe: "<p>Deutsches Transkript.</p>",
      transcriptEn: "<p>English transcript.</p>",
    },
    { type: "HTML", content: "<div>wird ignoriert</div>" },
    { type: "AUDIO", transcriptDe: "", transcriptEn: "<p>Only English.</p>" },
  ];

  it("sammelt Texte und sprachpassende Transkripte als Plain-Text", () => {
    const de = lessonStudyText(blocks, "de");
    expect(de).toContain("Die Sonne ist ein Stern.");
    expect(de).toContain("Deutsches Transkript.");
    // Audio hat kein deutsches Transkript → englischer Fallback
    expect(de).toContain("Only English.");
    expect(de).not.toContain("wird ignoriert");
    expect(de).not.toContain("<strong>");

    const en = lessonStudyText(blocks, "en");
    expect(en).toContain("English transcript.");
  });

  it("leer bei Lektionen ohne Lerntext", () => {
    expect(lessonStudyText([{ type: "IMAGE" }], "de")).toBe("");
  });

  it("überspringt Medien ganz ohne Transkript", () => {
    expect(
      lessonStudyText(
        [{ type: "VIDEO", transcriptDe: "", transcriptEn: "" }],
        "de"
      )
    ).toBe("");
  });

  it("fällt bei fehlendem EN-Transkript auf DE zurück", () => {
    const text = lessonStudyText(
      [{ type: "VIDEO", transcriptDe: "<p>Nur Deutsch.</p>", transcriptEn: "" }],
      "en"
    );
    expect(text).toContain("Nur Deutsch.");
  });
});

describe("hasSelfTestContent", () => {
  it("true erst ab der Mindestmenge an Lernstoff", () => {
    const long = "x".repeat(SELF_TEST_MIN_CHARS);
    expect(
      hasSelfTestContent([{ type: "TEXT", content: `<p>${long}</p>` }], "de")
    ).toBe(true);
    expect(
      hasSelfTestContent([{ type: "TEXT", content: "<p>zu kurz</p>" }], "de")
    ).toBe(false);
    expect(hasSelfTestContent([{ type: "IMAGE" }], "de")).toBe(false);
  });

  it("zählt sprachpassende Transkripte mit", () => {
    const long = "y".repeat(SELF_TEST_MIN_CHARS);
    expect(
      hasSelfTestContent(
        [{ type: "AUDIO", transcriptDe: `<p>${long}</p>`, transcriptEn: "" }],
        "en" // EN fehlt → DE-Fallback zählt
      )
    ).toBe(true);
  });
});

describe("selfTestContentHash", () => {
  it("ändert sich mit Inhalt und Sprache", () => {
    const a = selfTestContentHash("Stoff A", "de");
    expect(a).toBe(selfTestContentHash("Stoff A", "de"));
    expect(a).not.toBe(selfTestContentHash("Stoff B", "de"));
    expect(a).not.toBe(selfTestContentHash("Stoff A", "en"));
  });
});

describe("buildSelfTestPrompt", () => {
  it("enthält Regeln, Sprache und gekürzten Stoff", () => {
    const prompt = buildSelfTestPrompt({
      studyText: "S".repeat(30_000),
      lang: "en",
    });
    expect(prompt).toContain(`${SELF_TEST_QUESTION_COUNT} Übungsfragen`);
    expect(prompt).toContain("Englisch");
    expect(prompt.length).toBeLessThan(25_000);
    expect(
      buildSelfTestPrompt({ studyText: "x", lang: "de" })
    ).toContain("Deutsch");
  });
});

describe("parseSelfTestResponse", () => {
  it("parst gültige Fragen inkl. Code-Zaun", () => {
    const raw = "```json\n" + JSON.stringify({ questions: [QUESTION] }) + "\n```";
    expect(parseSelfTestResponse(raw)).toEqual([QUESTION]);
  });

  it("verwirft Fragen ohne genau eine richtige Antwort", () => {
    const broken = {
      ...QUESTION,
      options: QUESTION.options.map((o) => ({ ...o, correct: true })),
    };
    const raw = JSON.stringify({ questions: [broken, QUESTION] });
    expect(parseSelfTestResponse(raw)).toEqual([QUESTION]);
  });

  it("leer bei kaputtem JSON oder falscher Form", () => {
    expect(parseSelfTestResponse("kein json")).toEqual([]);
    expect(parseSelfTestResponse('{"questions":"x"}')).toEqual([]);
  });
});

describe("parseSelfTestOptions", () => {
  it("parst gültige Optionen und verwirft kaputte", () => {
    expect(parseSelfTestOptions(QUESTION.options)).toEqual(QUESTION.options);
    expect(parseSelfTestOptions([{ text: "", correct: true }])).toEqual([]);
    expect(parseSelfTestOptions("x")).toEqual([]);
  });
});
