import { describe, expect, it } from "vitest";
import {
  COURSE_LANGUAGES,
  courseLanguages,
  isCourseLanguage,
  languageDisplayName,
  lessonDurationForLocale,
  parseBlockTranslations,
  parseCourseTranslations,
  parseExtraLanguages,
  parseTitleTranslations,
  pickCourseLanguage,
  resolveBlock,
  resolveCourseText,
  serializeExtraLanguages,
  translatedText,
} from "./course-i18n";

describe("language helpers", () => {
  it("knows the supported course languages", () => {
    expect(COURSE_LANGUAGES).toEqual(["de", "en"]);
    expect(isCourseLanguage("de")).toBe(true);
    expect(isCourseLanguage("fr")).toBe(false);
    expect(isCourseLanguage(null)).toBe(false);
  });

  it("parses extra languages from CSV, dropping base, unknown and duplicates", () => {
    expect(parseExtraLanguages("en", "de")).toEqual(["en"]);
    expect(parseExtraLanguages(" en , en ,fr, de", "de")).toEqual(["en"]);
    expect(parseExtraLanguages("", "de")).toEqual([]);
    expect(parseExtraLanguages(null, "de")).toEqual([]);
    expect(parseExtraLanguages(undefined, "de")).toEqual([]);
  });

  it("serializes extra languages back to CSV without the base language", () => {
    expect(serializeExtraLanguages(["en", "de", "en"], "de")).toBe("en");
    expect(serializeExtraLanguages([], "de")).toBe("");
  });

  it("lists all course languages with the base language first", () => {
    expect(courseLanguages({ language: "de", extraLanguages: "en" })).toEqual([
      "de",
      "en",
    ]);
    expect(courseLanguages({ language: "en", extraLanguages: "" })).toEqual([
      "en",
    ]);
    expect(courseLanguages({ language: "en", extraLanguages: null })).toEqual([
      "en",
    ]);
  });

  it("picks the first available preferred language, falling back to base", () => {
    expect(pickCourseLanguage(["de", "en"], "en")).toBe("en");
    expect(pickCourseLanguage(["de", "en"], "fr", "en")).toBe("en");
    expect(pickCourseLanguage(["de"], "en")).toBe("de");
    expect(pickCourseLanguage(["de", "en"], null, undefined)).toBe("de");
  });

  it("schreibt Sprachnamen lokalisiert aus", () => {
    expect(languageDisplayName("de", "de")).toBe("Deutsch");
    expect(languageDisplayName("en", "de")).toBe("Englisch");
    expect(languageDisplayName("de", "en")).toBe("German");
    expect(languageDisplayName("en", "en")).toBe("English");
  });

  it("fällt bei unbekannten Codes auf das Kürzel zurück", () => {
    // "zz" ist syntaktisch gültig, aber ohne Anzeigename
    expect(languageDisplayName("zz", "de")).toBe("ZZ");
    // syntaktisch ungültiger Tag darf nicht werfen
    expect(languageDisplayName("nicht gültig!", "de")).toBe("NICHT GÜLTIG!");
  });
});

describe("translatedText", () => {
  const translations = { en: { title: "Hello", subtitle: "" } };

  it("returns the translated value when present and non-empty", () => {
    expect(translatedText(translations, "en", "title", "Hallo")).toBe("Hello");
  });

  it("falls back to the base value for empty or missing translations", () => {
    expect(translatedText(translations, "en", "subtitle", "Basis")).toBe(
      "Basis"
    );
    expect(translatedText(translations, "en", "unknown", "Basis")).toBe(
      "Basis"
    );
    expect(translatedText(null, "en", "title", "Basis")).toBe("Basis");
    expect(translatedText("kaputt", "en", "title", "Basis")).toBe("Basis");
    expect(translatedText({ en: "kaputt" }, "en", "title", "Basis")).toBe(
      "Basis"
    );
  });
});

describe("resolveCourseText", () => {
  const course = {
    language: "de",
    title: "Deutscher Titel",
    subtitle: "Deutscher Untertitel",
    description: "Deutsche Beschreibung",
    translations: {
      en: { title: "English title", subtitle: "", description: null },
    },
  };

  it("returns base fields for the base language", () => {
    expect(resolveCourseText(course, "de")).toEqual({
      title: "Deutscher Titel",
      subtitle: "Deutscher Untertitel",
      description: "Deutsche Beschreibung",
    });
  });

  it("mixes translated and fallback fields per field", () => {
    expect(resolveCourseText(course, "en")).toEqual({
      title: "English title",
      subtitle: "Deutscher Untertitel",
      description: "Deutsche Beschreibung",
    });
  });

  it("handles null subtitle/description bases", () => {
    expect(
      resolveCourseText(
        { ...course, subtitle: null, description: null, translations: null },
        "en"
      )
    ).toEqual({
      title: "Deutscher Titel",
      subtitle: null,
      description: null,
    });
  });
});

describe("resolveBlock", () => {
  const videoBlock = {
    type: "VIDEO",
    title: "Intro",
    url: "/uploads/u1/intro-de.mp4",
    fileName: null,
    poster: "/uploads/u1/poster-de.jpg",
    content: null,
    durationSeconds: 120,
    translations: {
      en: {
        title: "Intro (EN)",
        url: "/uploads/u1/intro-en.mp4",
        durationSeconds: 130,
      },
    },
  };

  it("defaults missing fields to null/0", () => {
    const resolved = resolveBlock({ type: "TEXT", content: "x" }, "de", "de");
    expect(resolved.durationSeconds).toBe(0);
    expect(resolved.url).toBeNull();
    expect(resolved.title).toBeNull();
  });

  it("returns base media without fallback flag in the base language", () => {
    const resolved = resolveBlock(videoBlock, "de", "de");
    expect(resolved.url).toBe("/uploads/u1/intro-de.mp4");
    expect(resolved.durationSeconds).toBe(120);
    expect(resolved.mediaFallback).toBe(false);
    expect(resolved.textFallback).toBe(false);
  });

  it("uses translated media incl. its own duration", () => {
    const resolved = resolveBlock(videoBlock, "en", "de");
    expect(resolved.url).toBe("/uploads/u1/intro-en.mp4");
    expect(resolved.title).toBe("Intro (EN)");
    expect(resolved.durationSeconds).toBe(130);
    // Poster der Basis bleibt, solange kein eigenes gesetzt ist
    expect(resolved.poster).toBe("/uploads/u1/poster-de.jpg");
    expect(resolved.mediaFallback).toBe(false);
  });

  it("falls back to base media and flags it when no translated media exists", () => {
    const noTranslation = { ...videoBlock, translations: null };
    const resolved = resolveBlock(noTranslation, "en", "de");
    expect(resolved.url).toBe("/uploads/u1/intro-de.mp4");
    expect(resolved.durationSeconds).toBe(120);
    expect(resolved.mediaFallback).toBe(true);
  });

  it("keeps base duration when the translated media has none", () => {
    const withoutDuration = {
      ...videoBlock,
      translations: { en: { url: "/uploads/u1/intro-en.mp4" } },
    };
    expect(resolveBlock(withoutDuration, "en", "de").durationSeconds).toBe(
      120
    );
  });

  it("flags missing text translations for TEXT/HTML blocks", () => {
    const textBlock = {
      type: "TEXT",
      title: null,
      url: null,
      fileName: null,
      poster: null,
      content: "<p>Deutsch</p>",
      durationSeconds: 0,
      translations: { en: { content: "" } },
    };
    const fallback = resolveBlock(textBlock, "en", "de");
    expect(fallback.content).toBe("<p>Deutsch</p>");
    expect(fallback.textFallback).toBe(true);
    expect(fallback.mediaFallback).toBe(false);

    const translated = resolveBlock(
      { ...textBlock, translations: { en: { content: "<p>English</p>" } } },
      "en",
      "de"
    );
    expect(translated.content).toBe("<p>English</p>");
    expect(translated.textFallback).toBe(false);
  });

  it("resolves the provenance of the displayed content", () => {
    const block = {
      type: "TEXT",
      content: "<p>Basis</p>",
      provenance: "AI_REVIEWED",
      translations: {
        en: { content: "<p>Translated</p>", provenance: "AI" },
      },
    };
    // Basissprache → Basis-Herkunft
    expect(resolveBlock(block, "de", "de").provenance).toBe("AI_REVIEWED");
    // Übersetzung mit eigener Kennzeichnung
    expect(resolveBlock(block, "en", "de").provenance).toBe("AI");
    // Fallback (keine Übersetzung) erbt die Basis-Herkunft
    expect(
      resolveBlock({ ...block, translations: {} }, "en", "de").provenance
    ).toBe("AI_REVIEWED");
    // Unbekannt/fehlend → HUMAN
    expect(
      resolveBlock({ type: "TEXT", content: "x" }, "de", "de").provenance
    ).toBe("HUMAN");
  });

  it("uses translated file name and does not flag blocks without media", () => {
    const fileBlock = {
      type: "FILE",
      title: null,
      url: "/uploads/u1/skript-de.pdf",
      fileName: "Skript.pdf",
      poster: null,
      content: null,
      durationSeconds: 0,
      translations: {
        en: { url: "/uploads/u1/script-en.pdf", fileName: "Script.pdf" },
      },
    };
    const resolved = resolveBlock(fileBlock, "en", "de");
    expect(resolved.url).toBe("/uploads/u1/script-en.pdf");
    expect(resolved.fileName).toBe("Script.pdf");
    expect(resolved.mediaFallback).toBe(false);

    // Block ohne URL (kaputte Daten): kein Fallback-Badge
    const empty = resolveBlock(
      { ...fileBlock, url: null, translations: null },
      "en",
      "de"
    );
    expect(empty.mediaFallback).toBe(false);
  });
});

describe("draft parsers (DB-Json → Editor-Drafts)", () => {
  it("parses course translations with empty-string defaults", () => {
    expect(
      parseCourseTranslations({ en: { title: "Hi", junk: 1 }, fr: { title: "x" } })
    ).toEqual({ en: { title: "Hi", subtitle: "", description: "" } });
    expect(parseCourseTranslations(null)).toEqual({});
    expect(parseCourseTranslations("kaputt")).toEqual({});
  });

  it("parses title translations", () => {
    expect(parseTitleTranslations({ en: { title: "Lesson" } })).toEqual({
      en: { title: "Lesson" },
    });
    expect(parseTitleTranslations({ en: {} })).toEqual({
      en: { title: "" },
    });
    expect(parseTitleTranslations(undefined)).toEqual({});
  });

  it("parses block translations incl. duration coercion", () => {
    expect(
      parseBlockTranslations({
        en: { url: "/uploads/a.mp4", durationSeconds: 12.7, title: "T" },
      })
    ).toEqual({
      en: {
        title: "T",
        url: "/uploads/a.mp4",
        fileName: "",
        poster: "",
        content: "",
        durationSeconds: 12,
        provenance: "HUMAN",
      },
    });
    expect(
      parseBlockTranslations({ en: { durationSeconds: "zwölf" } }).en
        ?.durationSeconds
    ).toBe(0);
    expect(parseBlockTranslations(42)).toEqual({});
  });

  it("parses the provenance of block translations (default HUMAN)", () => {
    expect(
      parseBlockTranslations({ en: { content: "<p>x</p>", provenance: "AI" } })
        .en?.provenance
    ).toBe("AI");
    expect(
      parseBlockTranslations({ en: { content: "x", provenance: "ROBOT" } }).en
        ?.provenance
    ).toBe("HUMAN");
  });
});

describe("lessonDurationForLocale", () => {
  it("sums resolved video/audio durations for the locale", () => {
    const blocks = [
      {
        type: "VIDEO",
        url: "/uploads/a.mp4",
        durationSeconds: 100,
        translations: { en: { url: "/uploads/a-en.mp4", durationSeconds: 90 } },
      },
      {
        type: "AUDIO",
        url: "/uploads/b.mp3",
        durationSeconds: 50,
        translations: null,
      },
      { type: "TEXT", content: "x", durationSeconds: 0, translations: null },
    ];
    expect(lessonDurationForLocale(blocks, "de", "de")).toBe(150);
    // EN: übersetztes Video (90) + Original-Audio (50)
    expect(lessonDurationForLocale(blocks, "en", "de")).toBe(140);
  });
});
