import { describe, expect, it } from "vitest";
import {
  splitIntoTtsSegments,
  ttsChunksFromHtml,
  ttsSegmentsFromHtml,
  ttsSegmentHash,
  TTS_MODEL,
  TTS_VOICE,
  splitChunksForBrowserSpeech,
  BROWSER_MAX_SEGMENT_CHARS,
} from "./tts";

describe("splitIntoTtsSegments", () => {
  it("kurzer Text bleibt ein Segment", () => {
    expect(splitIntoTtsSegments("Hallo Welt.")).toEqual(["Hallo Welt."]);
  });

  it("Absätze sind harte Grenzen (lokales Caching bei Änderungen)", () => {
    expect(splitIntoTtsSegments("Absatz eins.\n\nAbsatz zwei.")).toEqual([
      "Absatz eins.",
      "Absatz zwei.",
    ]);
  });

  it("lange Absätze werden an Satzgrenzen geteilt", () => {
    const sentence = "Dies ist ein Satz mit einigen Wörtern darin. ";
    const text = sentence.repeat(30).trim(); // ~1350 Zeichen
    const segments = splitIntoTtsSegments(text);
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) {
      expect(segment.length).toBeLessThanOrEqual(600);
      // Teilung an Satzgrenzen: jedes Segment endet mit Satzzeichen
      expect(segment).toMatch(/[.!?…]$/);
    }
    expect(segments.join(" ")).toBe(text);
  });

  it("ein Satz ändert nur sein eigenes Segment", () => {
    const long = "Erster Satz hier. ".repeat(40).trim();
    const before = splitIntoTtsSegments(`${long}\n\nStabiler Absatz.`);
    const after = splitIntoTtsSegments(`${long}\n\nGeänderter Absatz.`);
    // gemeinsames Präfix bleibt identisch → Cache-Treffer
    expect(after.slice(0, -1)).toEqual(before.slice(0, -1));
    expect(after.at(-1)).not.toBe(before.at(-1));
  });

  it("überlange Sätze ohne Satzzeichen werden hart geteilt", () => {
    const monster = "wort ".repeat(300).trim(); // ~1500 Zeichen ohne Punkt
    const segments = splitIntoTtsSegments(monster);
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) {
      expect(segment.length).toBeLessThanOrEqual(600);
    }
  });

  it("leerer Text ergibt keine Segmente", () => {
    expect(splitIntoTtsSegments("")).toEqual([]);
    expect(splitIntoTtsSegments("   \n\n  ")).toEqual([]);
  });

  it("überlange reine Satzzeichen-Ketten crashen nicht", () => {
    const dots = ".".repeat(700);
    const segments = splitIntoTtsSegments(dots);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.join("")).toBe(dots);
  });
});

describe("ttsSegmentsFromHtml", () => {
  it("kombiniert Strip + Split", () => {
    const html = "<p>Hallo Welt.</p><p>Zweiter Absatz.</p>";
    expect(ttsSegmentsFromHtml(html)).toEqual([
      "Hallo Welt.",
      "Zweiter Absatz.",
    ]);
  });
});

describe("ttsChunksFromHtml", () => {
  it("unterscheidet Überschriften und Absätze", () => {
    const html =
      "<h2>Kapitel 1</h2><p>Erster Absatz.</p><h3>Unterthema</h3><p>Zweiter Absatz.</p>";
    expect(ttsChunksFromHtml(html)).toEqual([
      { text: "Kapitel 1", kind: "heading" },
      { text: "Erster Absatz.", kind: "paragraph" },
      { text: "Unterthema", kind: "heading" },
      { text: "Zweiter Absatz.", kind: "paragraph" },
    ]);
  });

  it("lange Absätze erben ihren Typ über alle Teil-Segmente", () => {
    const long = "Ein Satz mit einigen Wörtern darin. ".repeat(30).trim();
    const chunks = ttsChunksFromHtml(`<h2>Titel</h2><p>${long}</p>`);
    expect(chunks[0]).toEqual({ text: "Titel", kind: "heading" });
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks.slice(1)) {
      expect(chunk.kind).toBe("paragraph");
      expect(chunk.text.length).toBeLessThanOrEqual(600);
    }
  });

  it("Listen und Zitate zählen als Absätze", () => {
    expect(ttsChunksFromHtml("<ul><li>Eins</li><li>Zwei</li></ul>")).toEqual([
      { text: "Eins", kind: "paragraph" },
      { text: "Zwei", kind: "paragraph" },
    ]);
  });

  it("mehrere HTML-Blöcke lassen sich verketten (ein Block je TEXT-Baustein)", () => {
    const a = ttsChunksFromHtml("<p>Block eins.</p>");
    const b = ttsChunksFromHtml("<h2>Block zwei</h2>");
    expect([...a, ...b]).toEqual([
      { text: "Block eins.", kind: "paragraph" },
      { text: "Block zwei", kind: "heading" },
    ]);
  });

  it("leeres HTML ergibt keine Chunks", () => {
    expect(ttsChunksFromHtml("")).toEqual([]);
    expect(ttsChunksFromHtml("<p>  </p>")).toEqual([]);
  });
});

describe("ttsSegmentHash", () => {
  it("ist deterministisch und bindet Modell + Stimme ein", () => {
    const a = ttsSegmentHash("Hallo Welt.");
    expect(a).toBe(ttsSegmentHash("Hallo Welt."));
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(ttsSegmentHash("Hallo Welt!")).not.toBe(a);
  });

  it("Modell/Stimme sind Konstanten mit sinnvollen Werten", () => {
    expect(TTS_MODEL.length).toBeGreaterThan(0);
    expect(TTS_VOICE.length).toBeGreaterThan(0);
  });
});

describe("splitChunksForBrowserSpeech", () => {
  /* Chrome bricht eine einzelne Äußerung nach rund 15 Sekunden ab, ohne
     das Ende-Ereignis zu feuern – der Player wartet dann ewig. Deshalb
     werden Segmente für die Browser-Stimme deutlich kürzer gehalten. */
  it("teilt lange Segmente in mehrere kurze", () => {
    const long = Array.from({ length: 12 }, (_, i) => `Satz Nummer ${i}.`).join(
      " "
    );
    const result = splitChunksForBrowserSpeech(
      [{ text: long, kind: "paragraph" }],
      60
    );
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(60);
    }
  });

  it("behält kurze Segmente unverändert", () => {
    const chunks = [
      { text: "Kurz und knapp.", kind: "heading" as const },
      { text: "Auch das passt.", kind: "paragraph" as const },
    ];
    expect(splitChunksForBrowserSpeech(chunks, 60)).toEqual(chunks);
  });

  it("überträgt die Art des Segments auf alle Teile", () => {
    const long = Array.from({ length: 8 }, (_, i) => `Teil ${i}.`).join(" ");
    const result = splitChunksForBrowserSpeech(
      [{ text: long, kind: "heading" }],
      30
    );
    expect(result.length).toBeGreaterThan(1);
    expect(result.every((c) => c.kind === "heading")).toBe(true);
  });

  it("verwirft nichts und behält die Reihenfolge", () => {
    const result = splitChunksForBrowserSpeech(
      [
        { text: "Erstens.", kind: "paragraph" },
        { text: "Zweitens.", kind: "paragraph" },
      ],
      60
    );
    expect(result.map((c) => c.text)).toEqual(["Erstens.", "Zweitens."]);
  });

  it("nutzt ohne Angabe die Browser-Standardlänge", () => {
    const long = "Ein Satz mit Inhalt. ".repeat(40).trim();
    const result = splitChunksForBrowserSpeech([
      { text: long, kind: "paragraph" },
    ]);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(
        BROWSER_MAX_SEGMENT_CHARS
      );
    }
  });
});
