import { breakpoints, colors, fontFallbacks, maxWidth, radii } from "./primitives";

/* Web-Theme: exakt die Form, die styled-components' DefaultTheme in
   apps/web erwartet (px-Strings, CSS-Variablen für next/font). */

const px = <T extends Record<string, number>>(values: T) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, `${value}px`])
  ) as { [K in keyof T]: `${T[K]}px` };

export const theme = {
  colors,
  fonts: {
    display: `var(--font-display), ${fontFallbacks.display}`,
    body: `var(--font-body), ${fontFallbacks.body}`,
    mono: `var(--font-mono), ${fontFallbacks.mono}`,
  },
  radii: px(radii),
  shadows: {
    card: "0 8px 40px rgba(0, 0, 0, 0.35)",
    glow: "0 0 60px rgba(200, 255, 77, 0.18)",
    violetGlow: "0 0 80px rgba(139, 124, 255, 0.22)",
  },
  breakpoints: px(breakpoints),
  maxWidth: `${maxWidth}px`,
} as const;

export type AppTheme = typeof theme;
