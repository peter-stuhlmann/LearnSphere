import { describe, expect, it } from "vitest";
import {
  bucketIndexFor,
  HEAT_BUCKETS,
  HEAT_MIN_TOTAL,
  heatAreaPath,
  normalizeHeat,
  sanitizeBuckets,
} from "./heatmap";

describe("bucketIndexFor", () => {
  it("teilt die Dauer in relative Buckets", () => {
    expect(bucketIndexFor(0, 100)).toBe(0);
    expect(bucketIndexFor(50, 100)).toBe(HEAT_BUCKETS / 2);
    expect(bucketIndexFor(99.9, 100)).toBe(HEAT_BUCKETS - 1);
    // hinter dem Ende geklemmt
    expect(bucketIndexFor(150, 100)).toBe(HEAT_BUCKETS - 1);
  });

  it("-1 ohne Dauer oder bei negativer Zeit", () => {
    expect(bucketIndexFor(10, 0)).toBe(-1);
    expect(bucketIndexFor(-1, 100)).toBe(-1);
  });
});

describe("sanitizeBuckets", () => {
  it("dedupliziert, sortiert und verwirft Unsinn", () => {
    expect(sanitizeBuckets([3, 1, 3, 1.5, -1, HEAT_BUCKETS, "x", 0])).toEqual([
      0, 1, 3,
    ]);
    expect(sanitizeBuckets("x")).toEqual([]);
  });
});

describe("normalizeHeat", () => {
  it("normalisiert auf das Maximum", () => {
    const rows = [
      { bucket: 0, views: HEAT_MIN_TOTAL },
      { bucket: 1, views: HEAT_MIN_TOTAL / 2 },
    ];
    const heat = normalizeHeat(rows);
    expect(heat).not.toBeNull();
    expect(heat![0]).toBe(1);
    expect(heat![1]).toBe(0.5);
    expect(heat![2]).toBe(0);
    expect(heat).toHaveLength(HEAT_BUCKETS);
  });

  it("null bei zu wenig Datenpunkten", () => {
    expect(normalizeHeat([{ bucket: 0, views: HEAT_MIN_TOTAL - 1 }])).toBeNull();
    expect(normalizeHeat([])).toBeNull();
  });

  it("ignoriert Zeilen außerhalb des Bereichs", () => {
    const heat = normalizeHeat([
      { bucket: -1, views: 999 },
      { bucket: HEAT_BUCKETS, views: 999 },
      { bucket: 2, views: HEAT_MIN_TOTAL },
    ]);
    expect(heat![2]).toBe(1);
  });
});

describe("heatAreaPath", () => {
  it("baut einen geschlossenen Flächenpfad", () => {
    const path = heatAreaPath([0, 1]);
    expect(path.startsWith("M0,20 L")).toBe(true);
    expect(path.endsWith("L100,20 Z")).toBe(true);
    // Bucket mit Wert 1 erreicht die Oberkante (y = 2)
    expect(path).toContain(",2.0");
  });

  it("leer ohne Werte", () => {
    expect(heatAreaPath([])).toBe("");
  });
});
