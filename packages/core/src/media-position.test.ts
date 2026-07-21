import { describe, expect, it } from "vitest";
import {
  mergePositions,
  parsePositions,
  RESUME_EDGE_SECONDS,
  resumePosition,
} from "./media-position";

describe("parsePositions", () => {
  it("parst gültige Maps und floored Sekunden", () => {
    expect(parsePositions({ a: 12.9, b: 0 })).toEqual({ a: 12, b: 0 });
  });

  it("verwirft ungültige Formen und Werte", () => {
    expect(parsePositions(null)).toEqual({});
    expect(parsePositions("kaputt")).toEqual({});
    expect(parsePositions([1, 2])).toEqual({});
    expect(parsePositions({ a: -5, b: "x", c: NaN, d: 7 })).toEqual({ d: 7 });
  });
});

describe("mergePositions", () => {
  it("neuer Stand überschreibt den alten, Rest bleibt", () => {
    expect(mergePositions({ a: 10, b: 20 }, { b: 99, c: 5 })).toEqual({
      a: 10,
      b: 99,
      c: 5,
    });
  });

  it("kommt mit kaputtem Bestand klar", () => {
    expect(mergePositions("kaputt", { a: 3 })).toEqual({ a: 3 });
  });
});

describe("resumePosition", () => {
  it("setzt mitten im Medium fort", () => {
    expect(resumePosition(120, 600)).toBe(120);
    expect(resumePosition(120.7, 600)).toBe(120);
  });

  it("startet ohne gespeicherte Position bei 0", () => {
    expect(resumePosition(undefined, 600)).toBe(0);
    expect(resumePosition(0, 600)).toBe(0);
  });

  it("ignoriert Positionen ganz am Anfang und kurz vor Schluss", () => {
    expect(resumePosition(RESUME_EDGE_SECONDS - 1, 600)).toBe(0);
    expect(resumePosition(600 - RESUME_EDGE_SECONDS + 1, 600)).toBe(0);
    // exakt am Rand ist noch ok
    expect(resumePosition(RESUME_EDGE_SECONDS, 600)).toBe(RESUME_EDGE_SECONDS);
  });

  it("erlaubt Fortsetzen bei unbekannter Dauer", () => {
    expect(resumePosition(42, 0)).toBe(42);
  });
});
