import { describe, expect, it } from "vitest";
import {
  activeChapterAt,
  buildChapterPrompt,
  formatChapterTime,
  MAX_CHAPTERS,
  parseChapterResponse,
  parseChapters,
  parseTimeInput,
  sortChapters,
} from "./chapters";

describe("parseChapters", () => {
  it("parst, sortiert und floored gültige Kapitel", () => {
    expect(
      parseChapters([
        { t: 90.7, title: "Mitte" },
        { t: 0, title: "Intro" },
      ])
    ).toEqual([
      { t: 0, title: "Intro" },
      { t: 90, title: "Mitte" },
    ]);
  });

  it("verwirft kaputte Einträge und fremde Formen", () => {
    expect(parseChapters(null)).toEqual([]);
    expect(parseChapters("x")).toEqual([]);
    expect(
      parseChapters([{ t: -5, title: "neg" }, { t: 3 }, { t: 5, title: "ok" }])
    ).toEqual([{ t: 5, title: "ok" }]);
  });

  it("begrenzt auf MAX_CHAPTERS", () => {
    const many = Array.from({ length: MAX_CHAPTERS + 10 }, (_, i) => ({
      t: i,
      title: `K${i}`,
    }));
    expect(parseChapters(many)).toHaveLength(MAX_CHAPTERS);
  });
});

describe("sortChapters", () => {
  it("fasst doppelte Startzeiten zusammen (letzte gewinnt) und trimmt", () => {
    expect(
      sortChapters([
        { t: 10, title: "Alt" },
        { t: 10.9, title: "  Neu  " },
        { t: 0, title: "Start" },
      ])
    ).toEqual([
      { t: 0, title: "Start" },
      { t: 10, title: "Neu" },
    ]);
  });
});

describe("activeChapterAt", () => {
  const chapters = [
    { t: 0, title: "Intro" },
    { t: 60, title: "Hauptteil" },
    { t: 120, title: "Fazit" },
  ];

  it("liefert das laufende Kapitel", () => {
    expect(activeChapterAt(chapters, 0)?.title).toBe("Intro");
    expect(activeChapterAt(chapters, 59)?.title).toBe("Intro");
    expect(activeChapterAt(chapters, 60)?.title).toBe("Hauptteil");
    expect(activeChapterAt(chapters, 999)?.title).toBe("Fazit");
  });

  it("null vor dem ersten Kapitel und ohne Kapitel", () => {
    expect(activeChapterAt([{ t: 30, title: "Spät" }], 10)).toBeNull();
    expect(activeChapterAt([], 10)).toBeNull();
  });
});

describe("Zeitformat", () => {
  it("formatiert Sekunden lesbar", () => {
    expect(formatChapterTime(0)).toBe("0:00");
    expect(formatChapterTime(75)).toBe("1:15");
    expect(formatChapterTime(3671)).toBe("1:01:11");
    expect(formatChapterTime(-3)).toBe("0:00");
  });

  it("parst m:ss, h:mm:ss und nackte Sekunden", () => {
    expect(parseTimeInput("1:15")).toBe(75);
    expect(parseTimeInput("1:01:11")).toBe(3671);
    expect(parseTimeInput("90")).toBe(90);
    expect(parseTimeInput(" 0:05 ")).toBe(5);
  });

  it("lehnt unlesbare Eingaben ab", () => {
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("1:99")).toBeNull();
    expect(parseTimeInput("abc")).toBeNull();
    expect(parseTimeInput("1:2:3:4")).toBeNull();
  });
});

describe("KI-Vorschlag", () => {
  it("baut den Prompt mit Dauer, Sprache und gekürztem Transkript", () => {
    const prompt = buildChapterPrompt({
      transcript: "T".repeat(30_000),
      durationSeconds: 600.9,
      language: "en",
    });
    expect(prompt).toContain("600 Sekunden");
    expect(prompt).toContain("Englisch");
    expect(prompt.length).toBeLessThan(25_000);
    expect(
      buildChapterPrompt({
        transcript: "kurz",
        durationSeconds: 60,
        language: "de",
      })
    ).toContain("Deutsch");
  });

  it("parst die Modell-Antwort inkl. Code-Zaun und klemmt auf die Dauer", () => {
    const raw =
      '```json\n{"chapters":[{"t":0,"title":"Intro"},{"t":500,"title":"Zu spät"},{"t":60,"title":"Mitte"}]}\n```';
    expect(parseChapterResponse(raw, 300)).toEqual([
      { t: 0, title: "Intro" },
      { t: 60, title: "Mitte" },
    ]);
  });

  it("erlaubt alle Zeiten bei unbekannter Dauer", () => {
    const raw = '{"chapters":[{"t":500,"title":"Spät"}]}';
    expect(parseChapterResponse(raw, 0)).toEqual([{ t: 500, title: "Spät" }]);
  });

  it("liefert leer bei kaputtem JSON", () => {
    expect(parseChapterResponse("kein json", 300)).toEqual([]);
  });
});
