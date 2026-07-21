import { describe, expect, it } from "vitest";
import {
  COVER_ASPECT,
  COVER_HEIGHT,
  COVER_WIDTH,
  initialCrop,
  MIN_CROP_WIDTH,
  moveCrop,
  resizeCrop,
} from "./crop";

describe("cover constants", () => {
  it("target output is 992×558", () => {
    expect(COVER_WIDTH).toBe(992);
    expect(COVER_HEIGHT).toBe(558);
    expect(COVER_ASPECT).toBeCloseTo(992 / 558);
  });
});

describe("initialCrop", () => {
  it("uses the full width on tall images, centered vertically", () => {
    const crop = initialCrop(1000, 2000);
    expect(crop.width).toBe(1000);
    expect(crop.height).toBeCloseTo(1000 / COVER_ASPECT);
    expect(crop.x).toBe(0);
    expect(crop.y).toBeCloseTo((2000 - crop.height) / 2);
  });

  it("uses the full height on wide images, centered horizontally", () => {
    const crop = initialCrop(4000, 558);
    expect(crop.height).toBe(558);
    expect(crop.width).toBeCloseTo(992);
    expect(crop.x).toBeCloseTo((4000 - crop.width) / 2);
    expect(crop.y).toBe(0);
  });

  it("keeps the target aspect ratio", () => {
    const crop = initialCrop(1234, 777);
    expect(crop.width / crop.height).toBeCloseTo(COVER_ASPECT);
  });
});

describe("moveCrop", () => {
  const crop = { x: 100, y: 100, width: 500, height: 500 / COVER_ASPECT };

  it("moves within the image", () => {
    const moved = moveCrop(crop, 50, -20, 2000, 2000);
    expect(moved.x).toBe(150);
    expect(moved.y).toBe(80);
  });

  it("clamps at the image edges", () => {
    const moved = moveCrop(crop, -500, 99999, 2000, 2000);
    expect(moved.x).toBe(0);
    expect(moved.y).toBeCloseTo(2000 - crop.height);
  });
});

describe("resizeCrop", () => {
  const crop = { x: 100, y: 100, width: 500, height: 500 / COVER_ASPECT };

  it("grows keeping the aspect ratio", () => {
    const resized = resizeCrop(crop, 200, 4000, 4000);
    expect(resized.width).toBe(700);
    expect(resized.height).toBeCloseTo(700 / COVER_ASPECT);
    expect(resized.x).toBe(100);
  });

  it("never exceeds the image bounds", () => {
    const resized = resizeCrop(crop, 99999, 1000, 5000);
    expect(resized.width).toBeCloseTo(900); // 1000 - x
    const tall = resizeCrop(crop, 99999, 5000, 400);
    expect(tall.height).toBeCloseTo(300); // 400 - y
  });

  it("never shrinks below the minimum width", () => {
    const resized = resizeCrop(crop, -99999, 2000, 2000);
    expect(resized.width).toBe(MIN_CROP_WIDTH);
  });
});
