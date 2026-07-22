import { describe, expect, it } from "vitest";
import { assistantCoverage, type CoverageSection } from "./coverage";

const video = (transcript?: string, durationSeconds = 600) => ({
  type: "VIDEO",
  transcriptDe: transcript ?? "",
  durationSeconds,
});

describe("assistantCoverage", () => {
  it("zählt Medienblöcke mit und ohne Transkript", () => {
    const sections: CoverageSection[] = [
      {
        title: "Grundlagen",
        lessons: [
          {
            id: "l1",
            title: "Erste Schritte",
            blocks: [video("Gesprochener Text"), video()],
          },
        ],
      },
    ];
    const report = assistantCoverage(sections);
    expect(report.mediaBlocks).toBe(2);
    expect(report.withTranscript).toBe(1);
    expect(report.percent).toBe(50);
    expect(report.missingSeconds).toBe(600);
    expect(report.gaps).toEqual([
      {
        lessonId: "l1",
        sectionTitle: "Grundlagen",
        lessonTitle: "Erste Schritte",
        blocks: 1,
        seconds: 600,
      },
    ]);
  });

  it("ein englisches Transkript genügt", () => {
    const report = assistantCoverage([
      {
        title: "S",
        lessons: [
          {
            id: "l",
            title: "L",
            blocks: [{ type: "VIDEO", transcriptEn: "Spoken words" }],
          },
        ],
      },
    ]);
    expect(report.percent).toBe(100);
    expect(report.gaps).toEqual([]);
  });

  it("Leerzeichen gelten nicht als Transkript", () => {
    const report = assistantCoverage([
      {
        title: "S",
        lessons: [{ id: "l", title: "L", blocks: [video("   ")] }],
      },
    ]);
    expect(report.percent).toBe(0);
  });

  it("Kurse ohne Medien gelten als vollständig erfasst", () => {
    /* Ein reiner Textkurs ist nicht "0 % bekannt" – sein Inhalt steht in
       Textblöcken, die der Assistent ohnehin liest. */
    const report = assistantCoverage([
      {
        title: "S",
        lessons: [
          { id: "l", title: "L", blocks: [{ type: "TEXT", content: "<p>Hi</p>" }] },
        ],
      },
    ]);
    expect(report.mediaBlocks).toBe(0);
    expect(report.percent).toBe(100);
    expect(report.gaps).toEqual([]);
  });

  it("unbekannte Spielzeit zählt als 0 Sekunden, die Lücke bleibt", () => {
    const report = assistantCoverage([
      {
        title: "S",
        lessons: [
          { id: "l", title: "L", blocks: [{ type: "AUDIO", transcriptDe: "" }] },
        ],
      },
    ]);
    expect(report.missingSeconds).toBe(0);
    expect(report.gaps[0].blocks).toBe(1);
  });

  it("leerer Kurs ergibt einen leeren Bericht", () => {
    expect(assistantCoverage([])).toEqual({
      mediaBlocks: 0,
      withTranscript: 0,
      percent: 100,
      missingSeconds: 0,
      gaps: [],
    });
  });
});
