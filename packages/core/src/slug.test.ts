import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and replaces spaces with dashes", () => {
    expect(slugify("Hallo Welt")).toBe("hallo-welt");
  });

  it("transliterates German umlauts", () => {
    expect(slugify("Über Fußgänger & Öl")).toBe("ueber-fussgaenger-oel");
  });

  it("strips special characters", () => {
    expect(slugify("React: Der Kurs! (2026)")).toBe("react-der-kurs-2026");
  });

  it("collapses consecutive separators and trims dashes", () => {
    expect(slugify("  --Viel   Spaß--  ")).toBe("viel-spass");
  });

  it("returns 'kurs' for input without usable characters", () => {
    expect(slugify("!!!")).toBe("kurs");
  });
});

describe("uniqueSlug", () => {
  it("keeps the base slug when free", () => {
    expect(uniqueSlug("mein-kurs", new Set())).toBe("mein-kurs");
  });

  it("appends an incrementing counter on collision", () => {
    const taken = new Set(["mein-kurs", "mein-kurs-2"]);
    expect(uniqueSlug("mein-kurs", taken)).toBe("mein-kurs-3");
  });
});
