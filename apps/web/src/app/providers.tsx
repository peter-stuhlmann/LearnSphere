"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "styled-components";
import { StyledComponentsRegistry } from "@/lib/registry";
import { GlobalStyle } from "@/styles/GlobalStyle";
import { theme } from "@/styles/theme";

/**
 * Auf einem Whitelabel-Mandanten-Host überschreibt `colorOverride` einzelne
 * Theme-Farben (im Layout aus der Mandanten-Palette abgeleitet). Das ganze
 * Portal – Header, Inhalt, Footer, GlobalStyle-Hintergrund – nutzt so die
 * Marke des Betreibers.
 */
export function Providers({
  children,
  colorOverride,
}: {
  children: ReactNode;
  colorOverride?: Record<string, string>;
}) {
  const activeTheme =
    colorOverride && Object.keys(colorOverride).length > 0
      ? { ...theme, colors: { ...theme.colors, ...colorOverride } }
      : theme;

  return (
    <StyledComponentsRegistry>
      <ThemeProvider theme={activeTheme}>
        <GlobalStyle />
        {children}
      </ThemeProvider>
    </StyledComponentsRegistry>
  );
}
