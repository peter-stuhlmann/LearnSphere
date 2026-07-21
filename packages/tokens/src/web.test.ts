import { describe, expect, it } from "vitest";
import { theme } from "./web";

/* Paritätstest: Das Web-Theme muss exakt dem historischen Literal aus
   apps/web/src/styles/theme.ts entsprechen – jede Abweichung würde das
   gesamte styled-components-UI unbemerkt verändern. */
describe("web theme", () => {
  it("entspricht dem ursprünglichen Theme-Literal", () => {
    expect(theme).toEqual({
      colors: {
        bg: "#0B0C15",
        bgElevated: "#12141F",
        bgDeep: "#07080F",
        surface: "rgba(255, 255, 255, 0.04)",
        surfaceHover: "rgba(255, 255, 255, 0.07)",
        border: "rgba(255, 255, 255, 0.1)",
        borderStrong: "rgba(255, 255, 255, 0.18)",
        text: "#EDEDF2",
        textMuted: "#A7A9BC",
        textFaint: "#8A8CA3",
        accent: "#C8FF4D",
        accentSoft: "rgba(200, 255, 77, 0.12)",
        onAccent: "#0B0C15",
        violet: "#8B7CFF",
        violetSoft: "rgba(139, 124, 255, 0.14)",
        partner: "#4DD8FF",
        partnerSoft: "rgba(77, 216, 255, 0.14)",
        danger: "#FF6B6B",
        dangerSoft: "rgba(255, 107, 107, 0.12)",
        success: "#4DFFA6",
        successSoft: "rgba(77, 255, 166, 0.12)",
      },
      fonts: {
        display: "var(--font-display), Georgia, serif",
        body: "var(--font-body), system-ui, sans-serif",
        mono: "var(--font-mono), ui-monospace, monospace",
      },
      radii: {
        sm: "8px",
        md: "14px",
        lg: "22px",
        pill: "999px",
      },
      shadows: {
        card: "0 8px 40px rgba(0, 0, 0, 0.35)",
        glow: "0 0 60px rgba(200, 255, 77, 0.18)",
        violetGlow: "0 0 80px rgba(139, 124, 255, 0.22)",
      },
      breakpoints: {
        sm: "480px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
      maxWidth: "1200px",
    });
  });
});
