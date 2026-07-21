import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_FONTS,
  CERTIFICATE_FRAMES,
  CERTIFICATE_LAYOUTS,
  CERTIFICATE_ORIENTATIONS,
  CERTIFICATE_PALETTES,
  DEFAULT_CERTIFICATE_THEME,
  paletteForMode,
  parseCertificateTheme,
} from "./theme";

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe("CERTIFICATE_PALETTES", () => {
  it("es gibt genau zwei Farbwelten: hell (daybreak) und dunkel (midnight)", () => {
    expect(Object.keys(CERTIFICATE_PALETTES).sort()).toEqual([
      "daybreak",
      "midnight",
    ]);
  });

  it("enthält nur gültige Hex-Farben", () => {
    for (const palette of Object.values(CERTIFICATE_PALETTES)) {
      expect(palette.background).toMatch(HEX);
      expect(palette.ink).toMatch(HEX);
      expect(palette.muted).toMatch(HEX);
      expect(palette.accent).toMatch(HEX);
      expect(palette.accent2).toMatch(HEX);
    }
  });
});

describe("paletteForMode", () => {
  it("hell ist Daybreak, dunkel ist Midnight – mehr nicht", () => {
    expect(paletteForMode("light")).toBe("daybreak");
    expect(paletteForMode("dark")).toBe("midnight");
  });
});

describe("parseCertificateTheme", () => {
  it("liefert Defaults für null/undefined/Nicht-Objekte", () => {
    expect(parseCertificateTheme(null)).toEqual(DEFAULT_CERTIFICATE_THEME);
    expect(parseCertificateTheme(undefined)).toEqual(
      DEFAULT_CERTIFICATE_THEME
    );
    expect(parseCertificateTheme("quatsch")).toEqual(
      DEFAULT_CERTIFICATE_THEME
    );
    expect(parseCertificateTheme(42)).toEqual(DEFAULT_CERTIFICATE_THEME);
    expect(parseCertificateTheme([])).toEqual(DEFAULT_CERTIFICATE_THEME);
  });

  it("übernimmt ein vollständig gültiges Theme unverändert", () => {
    const theme = {
      font: "modern",
      frame: "double",
      layout: "left",
      orientation: "portrait",
      showScore: false,
      signatureName: "Dr. Ada Lovelace",
      signatureRole: "Kursleitung",
      logo: "/uploads/cm123abc/deadbeef42.png",
    };
    expect(parseCertificateTheme(theme)).toEqual(theme);
  });

  it("fällt bei unbekannten Preset-Werten feldweise auf Defaults zurück", () => {
    const parsed = parseCertificateTheme({
      font: "comic-sans",
      frame: "blink",
      layout: "diagonal",
      orientation: "dodekaeder",
    });
    expect(parsed.font).toBe(DEFAULT_CERTIFICATE_THEME.font);
    expect(parsed.frame).toBe(DEFAULT_CERTIFICATE_THEME.frame);
    expect(parsed.layout).toBe(DEFAULT_CERTIFICATE_THEME.layout);
    expect(parsed.orientation).toBe(DEFAULT_CERTIFICATE_THEME.orientation);
  });

  it("Standard-Format ist Querformat, Hochformat ist wählbar", () => {
    expect(DEFAULT_CERTIFICATE_THEME.orientation).toBe("landscape");
    expect(
      parseCertificateTheme({ orientation: "portrait" }).orientation
    ).toBe("portrait");
  });

  it("ignoriert unbekannte Felder (z. B. die früheren palette/accent-Felder)", () => {
    const parsed = parseCertificateTheme({
      palette: "ocean",
      accent: "#FF6B6B",
    });
    expect(parsed).toEqual(DEFAULT_CERTIFICATE_THEME);
    expect("palette" in parsed).toBe(false);
    expect("accent" in parsed).toBe(false);
  });

  it("akzeptiert nur Logos aus der eigenen Upload-Pipeline (PNG/JPG)", () => {
    const ok = (logo: string) =>
      parseCertificateTheme({ logo }).logo === logo;
    expect(ok("/uploads/cm123abc/deadbeef42.png")).toBe(true);
    expect(ok("/uploads/cm123abc/deadbeef42.jpg")).toBe(true);
    // WebP/GIF versteht der PDF-Renderer nicht
    expect(ok("/uploads/cm123abc/deadbeef42.webp")).toBe(false);
    expect(ok("/uploads/cm123abc/deadbeef42.gif")).toBe(false);
    // fremde Quellen, Traversal, Nicht-Strings
    expect(ok("https://evil.example/logo.png")).toBe(false);
    expect(ok("/uploads/../secret.png")).toBe(false);
    expect(ok("uploads/cm123abc/x.png")).toBe(false);
    expect(parseCertificateTheme({ logo: 42 }).logo).toBeNull();
    expect(parseCertificateTheme({}).logo).toBeNull();
  });

  it("trimmt Signaturtexte und kappt sie auf 60 Zeichen", () => {
    const long = "x".repeat(80);
    const parsed = parseCertificateTheme({
      signatureName: `  Ada  `,
      signatureRole: long,
    });
    expect(parsed.signatureName).toBe("Ada");
    expect(parsed.signatureRole).toBe("x".repeat(60));
  });

  it("erzwingt Strings/Booleans für die restlichen Felder", () => {
    const parsed = parseCertificateTheme({
      showScore: "nein",
      signatureName: 123,
      signatureRole: { evil: true },
    });
    expect(parsed.showScore).toBe(DEFAULT_CERTIFICATE_THEME.showScore);
    expect(parsed.signatureName).toBe("");
    expect(parsed.signatureRole).toBe("");
  });
});

describe("Auswahl-Listen", () => {
  it("Fonts, Rahmen, Layouts und Formate sind nicht leer", () => {
    expect(Object.keys(CERTIFICATE_FONTS).length).toBeGreaterThan(1);
    expect(CERTIFICATE_FRAMES.length).toBeGreaterThan(1);
    expect(CERTIFICATE_LAYOUTS.length).toBeGreaterThan(1);
    expect(CERTIFICATE_ORIENTATIONS).toEqual(["landscape", "portrait"]);
  });
});
