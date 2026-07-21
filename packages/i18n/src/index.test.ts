import { describe, expect, it } from "vitest";
import de from "../messages/de.json";
import en from "../messages/en.json";
import { defaultLocale, getMessages, isAppLocale, locales } from "./index";

/* Rekursiver Key-Paritätstest: jede Message muss in beiden Sprachen
   existieren – fehlende Übersetzungen fallen so im Test auf, nicht im UI. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("message catalogs", () => {
  it("de und en haben identische Key-Struktur", () => {
    const deKeys = keyPaths(de).sort();
    const enKeys = keyPaths(en).sort();
    expect(enKeys).toEqual(deKeys);
  });

  it("kein Katalog ist leer", () => {
    expect(keyPaths(de).length).toBeGreaterThan(100);
  });
});

describe("locale helpers", () => {
  it("kennt de als Default und beide Locales", () => {
    expect(defaultLocale).toBe("de");
    expect(locales).toEqual(["de", "en"]);
  });

  it("isAppLocale unterscheidet gültige und ungültige Werte", () => {
    expect(isAppLocale("de")).toBe(true);
    expect(isAppLocale("en")).toBe(true);
    expect(isAppLocale("fr")).toBe(false);
    expect(isAppLocale(42)).toBe(false);
  });

  it("getMessages lädt den passenden Katalog", async () => {
    await expect(getMessages("de")).resolves.toEqual(de);
    await expect(getMessages("en")).resolves.toEqual(en);
  });
});
