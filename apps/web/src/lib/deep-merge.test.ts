import { describe, expect, it } from "vitest";
import { deepMerge } from "./deep-merge";

describe("deepMerge", () => {
  it("mergt verschachtelte Objekte rekursiv (base-Keys bleiben erhalten)", () => {
    const result = deepMerge(
      { a: { x: 1, y: 2 }, b: 9 },
      { a: { y: 3 } }
    );
    expect(result).toEqual({ a: { x: 1, y: 3 }, b: 9 });
  });

  it("überschreibt skalare Werte", () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("ersetzt ein Skalar durch ein Objekt (current ist kein Objekt)", () => {
    expect(deepMerge({ a: 1 }, { a: { x: 1 } })).toEqual({ a: { x: 1 } });
  });

  it("übernimmt neue Keys, die es in base nicht gibt (current undefined)", () => {
    expect(deepMerge({}, { a: { x: 1 } })).toEqual({ a: { x: 1 } });
  });

  it("ersetzt Arrays komplett statt sie zu mergen (value ist Array)", () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });

  it("ersetzt ein Array-current durch ein Objekt (current ist Array)", () => {
    expect(deepMerge({ a: [1] }, { a: { x: 1 } })).toEqual({ a: { x: 1 } });
  });

  it("übernimmt null als Override (value ist falsy)", () => {
    expect(deepMerge({ a: { x: 1 } }, { a: null })).toEqual({ a: null });
  });

  it("lässt das base-Objekt unverändert", () => {
    const base = { a: { x: 1 } };
    deepMerge(base, { a: { x: 2 } });
    expect(base).toEqual({ a: { x: 1 } });
  });
});
