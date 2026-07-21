import { describe, expect, it } from "vitest";
import { breakpoints, colors, radii } from "./primitives";
import { nativeTheme } from "./native";
import { theme as webTheme } from "./web";

describe("native theme", () => {
  it("teilt die Farbpalette 1:1 mit dem Web-Theme", () => {
    expect(nativeTheme.colors).toEqual(webTheme.colors);
    expect(nativeTheme.colors).toBe(colors);
  });

  it("nutzt numerische Radii/Breakpoints, die den Web-px-Werten entsprechen", () => {
    for (const [key, value] of Object.entries(radii)) {
      expect(webTheme.radii[key as keyof typeof radii]).toBe(`${value}px`);
      expect(nativeTheme.radii[key as keyof typeof radii]).toBe(value);
    }
    for (const [key, value] of Object.entries(breakpoints)) {
      expect(webTheme.breakpoints[key as keyof typeof breakpoints]).toBe(
        `${value}px`
      );
      expect(nativeTheme.breakpoints[key as keyof typeof breakpoints]).toBe(
        value
      );
    }
  });

  it("liefert eine 4er-Raster-Spacing-Funktion", () => {
    expect(nativeTheme.spacing(0)).toBe(0);
    expect(nativeTheme.spacing(2)).toBe(8);
    expect(nativeTheme.spacing(6)).toBe(24);
  });
});
