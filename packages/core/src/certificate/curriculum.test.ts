import { describe, expect, it } from "vitest";
import {
  buildCurriculumSnapshot,
  parseCurriculumSnapshot,
} from "./curriculum";

describe("buildCurriculumSnapshot", () => {
  it("übernimmt Abschnitte und Lektionen in ihrer Reihenfolge", () => {
    const snapshot = buildCurriculumSnapshot([
      {
        title: "Praxis",
        order: 1,
        lessons: [
          { title: "Teleskop", order: 0 },
          { title: "Sternbilder", order: 1 },
        ],
      },
      {
        title: "Grundlagen",
        order: 0,
        lessons: [
          { title: "Sterne", order: 1 },
          { title: "Sonnensystem", order: 0 },
        ],
      },
    ]);
    expect(snapshot).toEqual([
      { title: "Grundlagen", lessons: ["Sonnensystem", "Sterne"] },
      { title: "Praxis", lessons: ["Teleskop", "Sternbilder"] },
    ]);
  });

  it("leerer Kurs ergibt leeren Snapshot", () => {
    expect(buildCurriculumSnapshot([])).toEqual([]);
  });
});

describe("parseCurriculumSnapshot", () => {
  it("liest einen gültigen Snapshot zurück", () => {
    const snapshot = [
      { title: "Grundlagen", lessons: ["Sonnensystem", "Sterne"] },
      { title: "Praxis", lessons: [] },
    ];
    expect(parseCurriculumSnapshot(snapshot)).toEqual(snapshot);
  });

  it("liefert null für fehlende oder kaputte Daten", () => {
    expect(parseCurriculumSnapshot(null)).toBeNull();
    expect(parseCurriculumSnapshot(undefined)).toBeNull();
    expect(parseCurriculumSnapshot("quatsch")).toBeNull();
    expect(parseCurriculumSnapshot({ title: "kein Array" })).toBeNull();
    expect(parseCurriculumSnapshot([{ lessons: ["ohne Titel"] }])).toBeNull();
    expect(parseCurriculumSnapshot([{ title: "ok", lessons: [42] }])).toBeNull();
    expect(
      parseCurriculumSnapshot([{ title: "ok", lessons: "keine Liste" }])
    ).toBeNull();
  });

  it("Roundtrip: build → JSON → parse", () => {
    const snapshot = buildCurriculumSnapshot([
      { title: "A", order: 0, lessons: [{ title: "L1", order: 0 }] },
    ]);
    const roundtripped = parseCurriculumSnapshot(
      JSON.parse(JSON.stringify(snapshot))
    );
    expect(roundtripped).toEqual(snapshot);
  });
});
