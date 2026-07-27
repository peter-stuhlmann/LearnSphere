import { describe, expect, it } from "vitest";
import {
  contrastText,
  hasTenantPalette,
  luminance,
  shade,
  tenantColorOverride,
  withAlpha,
} from "./tenant-theme";

describe("withAlpha", () => {
  it("wandelt Hex in rgba mit Deckkraft", () => {
    expect(withAlpha("#C8FF4D", 0.14)).toBe("rgba(200, 255, 77, 0.14)");
    // ohne führendes # ebenfalls
    expect(withAlpha("000000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("gibt ungültige Eingaben unverändert zurück", () => {
    expect(withAlpha("nope", 0.5)).toBe("nope");
    expect(withAlpha("#12345", 0.5)).toBe("#12345");
  });
});

describe("shade", () => {
  it("hellt auf (amount > 0, Richtung Weiß)", () => {
    expect(shade("#000000", 0.5)).toBe("#808080");
    expect(shade("#ffffff", 0.5)).toBe("#ffffff"); // bleibt Weiß
  });

  it("dunkelt ab (amount < 0, Richtung Schwarz)", () => {
    expect(shade("#ffffff", -0.5)).toBe("#808080");
    expect(shade("#000000", -0.5)).toBe("#000000"); // bleibt Schwarz
  });

  it("gibt ungültige Eingaben unverändert zurück", () => {
    expect(shade("kaputt", 0.3)).toBe("kaputt");
  });
});

describe("luminance", () => {
  it("liefert 1 für Weiß und 0 für Schwarz", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#000000")).toBe(0);
  });

  it("liefert 0 für ungültige Eingaben", () => {
    expect(luminance("nope")).toBe(0);
  });
});

describe("contrastText", () => {
  it("wählt dunklen Text auf hellen Flächen", () => {
    expect(contrastText("#ffffff")).toBe("#0B0C15");
    expect(contrastText("#C8FF4D")).toBe("#0B0C15");
  });

  it("wählt hellen Text auf dunklen Flächen", () => {
    expect(contrastText("#000000")).toBe("#F2F3FA");
    expect(contrastText("#0B0C15")).toBe("#F2F3FA");
  });
});

describe("tenantColorOverride", () => {
  it("liefert für eine leere Palette keine Overrides", () => {
    expect(tenantColorOverride({})).toEqual({});
    expect(
      tenantColorOverride({ accent: "", background: null, text: "", secondary: null })
    ).toEqual({});
  });

  it("leitet Akzent-Töne inkl. Kontrast-Textfarbe ab", () => {
    const out = tenantColorOverride({ accent: "#C8FF4D" });
    expect(out.accent).toBe("#C8FF4D");
    expect(out.accentSoft).toBe("rgba(200, 255, 77, 0.14)");
    expect(out.onAccent).toBe("#0B0C15"); // heller Akzent → dunkler Text
  });

  it("passt Flächen/Rahmen an einen DUNKLEN Hintergrund an (helle Overlays)", () => {
    const out = tenantColorOverride({ background: "#0B0C15" });
    expect(out.bg).toBe("#0B0C15");
    expect(out.surface).toBe("rgba(255, 255, 255, 0.04)");
    expect(out.border).toBe("rgba(255, 255, 255, 0.12)");
    // dunkler BG: deutlich abgedunkeltes „deep", leicht aufgehelltes „elevated"
    expect(out.bgDeep).toBeDefined();
    expect(out.bgElevated).toBeDefined();
  });

  it("passt Flächen/Rahmen an einen HELLEN Hintergrund an (dunkle Overlays)", () => {
    const out = tenantColorOverride({ background: "#ffffff" });
    expect(out.bg).toBe("#ffffff");
    expect(out.surface).toBe("rgba(0, 0, 0, 0.04)");
    expect(out.borderStrong).toBe("rgba(0, 0, 0, 0.2)");
  });

  it("leitet Text- und Sekundär-Töne ab", () => {
    const out = tenantColorOverride({ text: "#EDEDF2", secondary: "#8B7CFF" });
    expect(out.text).toBe("#EDEDF2");
    expect(out.textMuted).toBe("rgba(237, 237, 242, 0.66)");
    expect(out.textFaint).toBe("rgba(237, 237, 242, 0.5)");
    expect(out.violet).toBe("#8B7CFF");
    expect(out.violetSoft).toBe("rgba(139, 124, 255, 0.14)");
  });
});

describe("hasTenantPalette", () => {
  it("erkennt gesetzte bzw. leere Paletten", () => {
    expect(hasTenantPalette({ accent: "#fff" })).toBe(true);
    expect(hasTenantPalette({ background: "#000" })).toBe(true);
    expect(hasTenantPalette({ text: "#111" })).toBe(true);
    expect(hasTenantPalette({ secondary: "#222" })).toBe(true);
    expect(hasTenantPalette({})).toBe(false);
    expect(
      hasTenantPalette({ accent: "", background: null, text: "", secondary: null })
    ).toBe(false);
  });
});
