import { describe, expect, it } from "vitest";
import { shuffleWithRng } from "./shuffle";

/** Deterministischer Pseudo-Zufall für reproduzierbare Tests. */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("shuffleWithRng", () => {
  it("returns a new array with the same elements", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffleWithRng(input, seededRng(42));
    expect(result).not.toBe(input);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it("is deterministic for the same rng seed", () => {
    const a = shuffleWithRng([1, 2, 3, 4, 5, 6, 7, 8], seededRng(7));
    const b = shuffleWithRng([1, 2, 3, 4, 5, 6, 7, 8], seededRng(7));
    expect(a).toEqual(b);
  });

  it("actually permutes for typical seeds", () => {
    const input = Array.from({ length: 10 }, (_, i) => i);
    const result = shuffleWithRng(input, seededRng(1));
    expect(result).not.toEqual(input);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffleWithRng([], seededRng(1))).toEqual([]);
    expect(shuffleWithRng(["x"], seededRng(1))).toEqual(["x"]);
  });
});
