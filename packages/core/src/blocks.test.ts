import { describe, expect, it } from "vitest";
import {
  lessonBlockSchema,
  lessonDurationFromBlocks,
  lessonSchema,
  parseTranscriptCues,
} from "./blocks";

describe("lessonBlockSchema", () => {
  it("accepts a video block with url and duration", () => {
    expect(
      lessonBlockSchema.safeParse({
        type: "VIDEO",
        title: "",
        url: "https://www.youtube.com/watch?v=V75dMMIW2B4",
        durationSeconds: 120,
      }).success
    ).toBe(true);
  });

  it("tracks the content provenance on text blocks (default HUMAN)", () => {
    const defaulted = lessonBlockSchema.parse({
      type: "TEXT",
      title: "",
      content: "<p>Hallo</p>",
    });
    expect(defaulted.type === "TEXT" ? defaulted.provenance : "").toBe("HUMAN");

    const marked = lessonBlockSchema.parse({
      type: "HTML",
      title: "",
      content: "<h1>Hi</h1>",
      provenance: "AI_REVIEWED",
    });
    expect(marked.type === "HTML" ? marked.provenance : "").toBe("AI_REVIEWED");

    expect(
      lessonBlockSchema.safeParse({
        type: "TEXT",
        title: "",
        content: "x",
        provenance: "ROBOT",
      }).success
    ).toBe(false);

    // Übersetzungen tragen ihre eigene Herkunft (Default HUMAN)
    const withTranslation = lessonBlockSchema.parse({
      type: "TEXT",
      title: "",
      content: "<p>Basis</p>",
      translations: { en: { content: "<p>En</p>", provenance: "AI" } },
    });
    expect(withTranslation.translations.en?.provenance).toBe("AI");
    const defaultTranslation = lessonBlockSchema.parse({
      type: "TEXT",
      title: "",
      content: "<p>Basis</p>",
      translations: { en: { content: "<p>En</p>" } },
    });
    expect(defaultTranslation.translations.en?.provenance).toBe("HUMAN");
  });

  it("accepts transcripts on video and audio blocks", () => {
    const parsed = lessonBlockSchema.parse({
      type: "AUDIO",
      title: "",
      url: "/uploads/u1/track.mp3",
      durationSeconds: 60,
      transcriptDe: "  Hallo Welt ",
      transcriptEn: "Hello world",
    });
    expect(
      parsed.type === "AUDIO" ? parsed.transcriptDe : ""
    ).toBe("Hallo Welt");
  });

  it("accepts timestamped transcript cues and defaults them to []", () => {
    const parsed = lessonBlockSchema.parse({
      type: "VIDEO",
      title: "",
      url: "/uploads/u1/clip.mp4",
      durationSeconds: 10,
      transcriptCues: [
        { start: 0, end: 4.2, de: " Hallo ", en: "Hello" },
        { start: 4.2, end: 9.5, de: "Welt" },
      ],
    });
    if (parsed.type !== "VIDEO") throw new Error("unexpected type");
    expect(parsed.transcriptCues).toEqual([
      { start: 0, end: 4.2, de: "Hallo", en: "Hello", speaker: "" },
      { start: 4.2, end: 9.5, de: "Welt", en: "", speaker: "" },
    ]);

    const empty = lessonBlockSchema.parse({
      type: "AUDIO",
      url: "/uploads/u1/track.mp3",
      durationSeconds: 5,
    });
    expect(empty.type === "AUDIO" ? empty.transcriptCues : null).toEqual([]);
  });

  it("accepts a poster url on video blocks and defaults to empty", () => {
    const withPoster = lessonBlockSchema.parse({
      type: "VIDEO",
      url: "/uploads/u1/clip.mp4",
      poster: "/uploads/u1/clip-poster.jpg",
      durationSeconds: 10,
    });
    expect(withPoster.type === "VIDEO" ? withPoster.poster : "").toBe(
      "/uploads/u1/clip-poster.jpg"
    );

    const without = lessonBlockSchema.parse({
      type: "VIDEO",
      url: "/uploads/u1/clip.mp4",
      durationSeconds: 10,
    });
    expect(without.type === "VIDEO" ? without.poster : "x").toBe("");

    expect(
      lessonBlockSchema.safeParse({
        type: "VIDEO",
        url: "/uploads/u1/clip.mp4",
        poster: "javascript:alert(1)",
        durationSeconds: 10,
      }).success
    ).toBe(false);
  });

  it("rejects cues with negative timestamps", () => {
    expect(
      lessonBlockSchema.safeParse({
        type: "VIDEO",
        url: "/uploads/u1/clip.mp4",
        durationSeconds: 10,
        transcriptCues: [{ start: -1, end: 2, de: "x", en: "" }],
      }).success
    ).toBe(false);
  });

  it("transcripts default to empty", () => {
    const parsed = lessonBlockSchema.parse({
      type: "VIDEO",
      title: "",
      url: "/uploads/u1/clip.mp4",
      durationSeconds: 10,
    });
    expect(parsed.type === "VIDEO" ? parsed.transcriptDe : "x").toBe("");
    expect(parsed.type === "VIDEO" ? parsed.transcriptEn : "x").toBe("");
  });

  it("rejects media blocks without url", () => {
    for (const type of ["VIDEO", "AUDIO", "IMAGE", "FILE"]) {
      expect(
        lessonBlockSchema.safeParse({ type, url: "", durationSeconds: 0 })
          .success
      ).toBe(false);
    }
  });

  it("rejects invalid urls", () => {
    expect(
      lessonBlockSchema.safeParse({
        type: "VIDEO",
        url: "javascript:alert(1)",
        durationSeconds: 0,
      }).success
    ).toBe(false);
  });

  it("accepts relative upload urls", () => {
    expect(
      lessonBlockSchema.safeParse({
        type: "AUDIO",
        url: "/uploads/abc/audio.mp3",
        durationSeconds: 60,
      }).success
    ).toBe(true);
  });

  it("accepts a text block with content", () => {
    expect(
      lessonBlockSchema.safeParse({ type: "TEXT", content: "Hallo" }).success
    ).toBe(true);
  });

  it("rejects text blocks without content", () => {
    expect(
      lessonBlockSchema.safeParse({ type: "TEXT", content: "  " }).success
    ).toBe(false);
  });

  it("accepts an html block with optional css", () => {
    expect(
      lessonBlockSchema.safeParse({
        type: "HTML",
        content: "<h1>Hi</h1>",
        css: "h1 { color: rebeccapurple; }",
      }).success
    ).toBe(true);
    expect(
      lessonBlockSchema.safeParse({ type: "HTML", content: "<p>x</p>" })
        .success
    ).toBe(true);
  });

  it("rejects html blocks without markup", () => {
    expect(
      lessonBlockSchema.safeParse({ type: "HTML", content: "" }).success
    ).toBe(false);
  });

  it("rejects negative durations", () => {
    expect(
      lessonBlockSchema.safeParse({
        type: "VIDEO",
        url: "https://example.com/v.mp4",
        durationSeconds: -5,
      }).success
    ).toBe(false);
  });
});

describe("block and lesson translations", () => {
  it("accepts per-language block overrides and defaults to none", () => {
    const parsed = lessonBlockSchema.parse({
      type: "VIDEO",
      title: "Intro",
      url: "/uploads/u1/intro-de.mp4",
      durationSeconds: 120,
      translations: {
        en: { url: "/uploads/u1/intro-en.mp4", durationSeconds: 130 },
      },
    });
    expect(parsed.translations.en?.url).toBe("/uploads/u1/intro-en.mp4");
    expect(parsed.translations.en?.durationSeconds).toBe(130);
    // fehlende Felder default-leer = Fallback auf Basis
    expect(parsed.translations.en?.title).toBe("");

    const bare = lessonBlockSchema.parse({
      type: "TEXT",
      content: "Hallo",
    });
    expect(bare.translations).toEqual({});
  });

  it("rejects invalid override urls and unknown languages", () => {
    expect(
      lessonBlockSchema.safeParse({
        type: "VIDEO",
        url: "/uploads/u1/a.mp4",
        translations: { en: { url: "javascript:alert(1)" } },
      }).success
    ).toBe(false);
    expect(
      lessonBlockSchema.safeParse({
        type: "TEXT",
        content: "Hallo",
        translations: { fr: { content: "Bonjour" } },
      }).success
    ).toBe(false);
  });

  it("accepts lesson title translations", () => {
    const parsed = lessonSchema.parse({
      title: "Lektion 1",
      blocks: [{ type: "TEXT", content: "Hallo" }],
      translations: { en: { title: "Lesson 1" } },
    });
    expect(parsed.translations.en?.title).toBe("Lesson 1");
    expect(
      lessonSchema.parse({
        title: "Lektion 1",
        blocks: [{ type: "TEXT", content: "Hallo" }],
      }).translations
    ).toEqual({});
  });
});

describe("parseTranscriptCues", () => {
  it("parses valid cue arrays from DB json", () => {
    expect(
      parseTranscriptCues([
        { start: 0, end: 2.5, de: "Hi", en: "Hi", speaker: "1" },
      ])
    ).toEqual([{ start: 0, end: 2.5, de: "Hi", en: "Hi", speaker: "1" }]);
    // Altbestand ohne speaker-Feld bleibt gültig
    expect(
      parseTranscriptCues([{ start: 0, end: 2.5, de: "Hi", en: "" }])
    ).toEqual([{ start: 0, end: 2.5, de: "Hi", en: "", speaker: "" }]);
  });

  it("turns null and malformed values into []", () => {
    expect(parseTranscriptCues(null)).toEqual([]);
    expect(parseTranscriptCues("kaputt")).toEqual([]);
    expect(parseTranscriptCues([{ start: "x" }])).toEqual([]);
  });
});

describe("lessonDurationFromBlocks", () => {
  it("sums video and audio durations", () => {
    expect(
      lessonDurationFromBlocks([
        { type: "VIDEO", durationSeconds: 100 },
        { type: "AUDIO", durationSeconds: 50 },
        { type: "IMAGE", durationSeconds: 999 }, // zählt nicht
        { type: "TEXT", durationSeconds: 0 },
      ])
    ).toBe(150);
  });

  it("treats missing durations as 0", () => {
    expect(lessonDurationFromBlocks([{ type: "VIDEO" }])).toBe(0);
  });

  it("returns 0 for lessons without media", () => {
    expect(lessonDurationFromBlocks([{ type: "TEXT", durationSeconds: 0 }])).toBe(0);
    expect(lessonDurationFromBlocks([])).toBe(0);
  });
});
