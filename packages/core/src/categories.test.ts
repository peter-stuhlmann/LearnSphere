import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  COURSE_CATEGORIES,
  isCourseCategory,
} from "./categories";

describe("COURSE_CATEGORIES", () => {
  it("provides around 20 categories with unique stable ids", () => {
    expect(COURSE_CATEGORIES.length).toBeGreaterThanOrEqual(20);
    const ids = COURSE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids are kebab-case (stable database values)", () => {
    for (const category of COURSE_CATEGORIES) {
      expect(category.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("every category has German and English labels", () => {
    for (const category of COURSE_CATEGORIES) {
      expect(category.de.length).toBeGreaterThan(1);
      expect(category.en.length).toBeGreaterThan(1);
    }
  });
});

describe("isCourseCategory", () => {
  it("accepts known ids and rejects unknown ones", () => {
    expect(isCourseCategory("programming")).toBe(true);
    expect(isCourseCategory("languages")).toBe(true);
    expect(isCourseCategory("nope")).toBe(false);
    expect(isCourseCategory("")).toBe(false);
  });
});

describe("categoryLabel", () => {
  it("returns the locale-specific label", () => {
    expect(categoryLabel("programming", "de")).toBe(
      "Programmierung & Software"
    );
    expect(categoryLabel("programming", "en")).toBe("Programming & Software");
  });

  it("falls back to the id for unknown categories", () => {
    expect(categoryLabel("ghost", "de")).toBe("ghost");
  });
});
