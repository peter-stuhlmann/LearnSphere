"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "styled-components";
import { StyledComponentsRegistry } from "@/lib/registry";
import { GlobalStyle } from "@/styles/GlobalStyle";
import { theme } from "@/styles/theme";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StyledComponentsRegistry>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        {children}
      </ThemeProvider>
    </StyledComponentsRegistry>
  );
}
