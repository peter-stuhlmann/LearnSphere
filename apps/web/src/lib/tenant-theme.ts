/**
 * Farb-Ableitung fürs Whitelabel-Portal: Aus wenigen Kernfarben (Akzent,
 * Hintergrund, Text, Sekundär) wird ein vollständiger Satz Theme-Tokens
 * abgeleitet (Soft-Varianten, Kontrast-Textfarbe, Flächen/Rahmen passend zur
 * Hintergrund-Helligkeit). Reine Funktionen – nutzbar im Editor (Live-Vorschau)
 * UND im Layout (echter Theme-Override).
 */

export interface TenantPalette {
  accent?: string | null;
  background?: string | null;
  text?: string | null;
  secondary?: string | null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => clamp(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** rgba-String mit gewünschter Deckkraft. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Aufhellen (amount > 0, Richtung Weiß) oder Abdunkeln (amount < 0). */
export function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return rgbToHex(
    rgb[0] + (target - rgb[0]) * t,
    rgb[1] + (target - rgb[1]) * t,
    rgb[2] + (target - rgb[2]) * t
  );
}

/** Relative Helligkeit (0 dunkel … 1 hell). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

/** Gut lesbare Textfarbe auf der gegebenen Fläche (dunkel oder hell). */
export function contrastText(hex: string): string {
  return luminance(hex) > 0.55 ? "#0B0C15" : "#F2F3FA";
}

/**
 * Aus der Kern-Palette die zu überschreibenden Theme-Farben ableiten. Fehlt
 * eine Kernfarbe, bleibt der jeweilige Bereich beim Plattform-Default.
 */
export function tenantColorOverride(
  palette: TenantPalette
): Record<string, string> {
  const out: Record<string, string> = {};

  if (palette.accent) {
    out.accent = palette.accent;
    out.accentSoft = withAlpha(palette.accent, 0.14);
    out.onAccent = contrastText(palette.accent);
  }

  if (palette.background) {
    const bg = palette.background;
    out.bg = bg;
    out.bgDeep = shade(bg, luminance(bg) > 0.5 ? -0.06 : -0.4);
    out.bgElevated = shade(bg, luminance(bg) > 0.5 ? -0.04 : 0.06);
    // Flächen/Rahmen als Overlay passend zur Hintergrund-Helligkeit: auf
    // hellem BG dunkle, auf dunklem BG helle Transparenzen (sonst unsichtbar).
    const rgb = luminance(bg) > 0.5 ? "0, 0, 0" : "255, 255, 255";
    out.surface = `rgba(${rgb}, 0.04)`;
    out.surfaceHover = `rgba(${rgb}, 0.08)`;
    out.border = `rgba(${rgb}, 0.12)`;
    out.borderStrong = `rgba(${rgb}, 0.2)`;
  }

  if (palette.text) {
    out.text = palette.text;
    out.textMuted = withAlpha(palette.text, 0.66);
    out.textFaint = withAlpha(palette.text, 0.5);
  }

  if (palette.secondary) {
    out.violet = palette.secondary;
    out.violetSoft = withAlpha(palette.secondary, 0.14);
  }

  return out;
}

/** true, wenn irgendeine Kernfarbe gesetzt ist (dann lohnt der Override). */
export function hasTenantPalette(palette: TenantPalette): boolean {
  return Boolean(
    palette.accent || palette.background || palette.text || palette.secondary
  );
}
