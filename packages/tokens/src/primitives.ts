/* Plattformneutrale Design-Tokens des "Night Observatory"-Designsystems.
   Nur reine Werte (Hex/RGBA-Strings, Zahlen) – Web- und Native-Themes
   werden in web.ts bzw. native.ts daraus zusammengesetzt. */

export const colors = {
  bg: "#0B0C15",
  bgElevated: "#12141F",
  bgDeep: "#07080F",
  surface: "rgba(255, 255, 255, 0.04)",
  surfaceHover: "rgba(255, 255, 255, 0.07)",
  border: "rgba(255, 255, 255, 0.1)",
  borderStrong: "rgba(255, 255, 255, 0.18)",
  text: "#EDEDF2",
  textMuted: "#A7A9BC",
  /* WCAG AA: mind. 4,5:1 auf allen App-Hintergründen (bg/bgDeep/bgElevated) */
  textFaint: "#8A8CA3",
  accent: "#C8FF4D",
  accentSoft: "rgba(200, 255, 77, 0.12)",
  onAccent: "#0B0C15",
  violet: "#8B7CFF",
  violetSoft: "rgba(139, 124, 255, 0.14)",
  /* Partnerprogramm-Bereich (drittes Areal neben Lernen/Studio) */
  partner: "#4DD8FF",
  partnerSoft: "rgba(77, 216, 255, 0.14)",
  danger: "#FF6B6B",
  dangerSoft: "rgba(255, 107, 107, 0.12)",
  success: "#4DFFA6",
  successSoft: "rgba(77, 255, 166, 0.12)",
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const breakpoints = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export const maxWidth = 1200;

/* Font-Fallback-Stacks ohne die Web-spezifischen CSS-Variablen –
   Web stellt seine next/font-Variablen voran, Native lädt konkrete
   Font-Files via expo-font und nutzt eigene Familiennamen. */
export const fontFallbacks = {
  display: "Georgia, serif",
  body: "system-ui, sans-serif",
  mono: "ui-monospace, monospace",
} as const;

export type Colors = typeof colors;
export type Radii = typeof radii;
export type Breakpoints = typeof breakpoints;
