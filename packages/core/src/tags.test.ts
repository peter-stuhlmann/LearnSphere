import { describe, expect, it } from "vitest";
import {
  MAX_TAG_LENGTH,
  MAX_TAGS,
  normalizeTag,
  normalizeTags,
  parseTags,
  serializeTags,
} from "./tags";

describe("normalizeTag", () => {
  it("trims, lowercases and hyphenates whitespace", () => {
    expect(normalizeTag("  React Hooks ")).toBe("react-hooks");
  });

  it("keeps letters, numbers and common tech chars", () => {
    expect(normalizeTag("C++")).toBe("c++");
    expect(normalizeTag("C#")).toBe("c#");
    expect(normalizeTag(".NET 8")).toBe(".net-8");
    expect(normalizeTag("Küche")).toBe("küche");
  });

  it("strips dangerous characters", () => {
    expect(normalizeTag("<script>alert(1)</script>")).toBe("scriptalert1script");
    expect(normalizeTag("a,b")).toBe("ab");
  });

  it("caps the length", () => {
    expect(normalizeTag("x".repeat(100))).toHaveLength(MAX_TAG_LENGTH);
  });
});

describe("normalizeTags", () => {
  it("drops empties and duplicates", () => {
    expect(normalizeTags(["React", "  ", "react", "Vue"])).toEqual([
      "react",
      "vue",
    ]);
  });

  it("caps the number of tags", () => {
    const many = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    expect(normalizeTags(many)).toHaveLength(MAX_TAGS);
  });
});

describe("serializeTags / parseTags", () => {
  it("round-trips", () => {
    const tags = ["react", "frontend", "hooks"];
    expect(parseTags(serializeTags(tags))).toEqual(tags);
  });

  it("empty list serializes to empty string", () => {
    expect(serializeTags([])).toBe("");
    expect(parseTags("")).toEqual([]);
  });
});
