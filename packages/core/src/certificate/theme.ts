/**
 * Zertifikat-Theme: der "gewisse Rahmen", in dem Creator ihr Zertifikat
 * gestalten dürfen. Alles ist auf kuratierte Presets + wenige freie Felder
 * begrenzt; `parseCertificateTheme` normalisiert beliebigen (DB-)Input
 * feldweise auf sichere Werte, damit PDF-Renderer und Vorschau nie mit
 * kaputten Daten arbeiten.
 */

export interface CertificatePalette {
  /** Anzeigename im Designer (de/en identisch, Eigennamen) */
  name: string;
  background: string;
  ink: string;
  muted: string;
  accent: string;
  /** Zweitakzent, z. B. für das Titelwort */
  accent2: string;
}

/** Genau zwei Farbwelten: hell (Daybreak) und dunkel (Midnight). Beide
 * stehen Lernenden immer als Download zur Verfügung – der Creator wählt
 * hier nichts, die Palette ist deshalb kein Theme-Feld. */
export const CERTIFICATE_PALETTES = {
  daybreak: {
    name: "Daybreak",
    background: "#F7F4EC",
    ink: "#14151F",
    muted: "#6E7085",
    accent: "#89B420",
    accent2: "#6E5FD9",
  },
  midnight: {
    name: "Midnight",
    background: "#101223",
    ink: "#F2F3FA",
    muted: "#9FA3C0",
    accent: "#C8FF4D",
    accent2: "#8B7CFF",
  },
} as const satisfies Record<string, CertificatePalette>;

export type CertificatePaletteId = keyof typeof CERTIFICATE_PALETTES;

export type CertificateMode = "light" | "dark";

/** Hell ist Daybreak, dunkel ist Midnight – mehr nicht. */
export function paletteForMode(mode: CertificateMode): CertificatePaletteId {
  return mode === "dark" ? "midnight" : "daybreak";
}

/**
 * Schriftpaare aus den in @react-pdf/renderer eingebauten Standardfonts –
 * keine Font-Uploads nötig, PDF bleibt klein und rendert überall gleich.
 */
export const CERTIFICATE_FONTS = {
  elegant: {
    name: "Elegant",
    body: "Helvetica",
    bodyBold: "Helvetica-Bold",
    display: "Times-Italic",
  },
  modern: {
    name: "Modern",
    body: "Helvetica",
    bodyBold: "Helvetica-Bold",
    display: "Helvetica-Bold",
  },
  classic: {
    name: "Classic",
    body: "Times-Roman",
    bodyBold: "Times-Bold",
    display: "Times-BoldItalic",
  },
  typewriter: {
    name: "Typewriter",
    body: "Courier",
    bodyBold: "Courier-Bold",
    display: "Courier-Bold",
  },
} as const;

export type CertificateFontId = keyof typeof CERTIFICATE_FONTS;

export const CERTIFICATE_FRAMES = [
  "single",
  "double",
  "accent",
  "none",
] as const;
export type CertificateFrameId = (typeof CERTIFICATE_FRAMES)[number];

export const CERTIFICATE_LAYOUTS = ["center", "left"] as const;
export type CertificateLayoutId = (typeof CERTIFICATE_LAYOUTS)[number];

/** A4 quer (Standard) oder hoch */
export const CERTIFICATE_ORIENTATIONS = ["landscape", "portrait"] as const;
export type CertificateOrientationId =
  (typeof CERTIFICATE_ORIENTATIONS)[number];

export interface CertificateTheme {
  font: CertificateFontId;
  frame: CertificateFrameId;
  layout: CertificateLayoutId;
  orientation: CertificateOrientationId;
  showScore: boolean;
  /** Freitext-Signatur unter der Linie, z. B. Name der Kursleitung */
  signatureName: string;
  signatureRole: string;
  /** Creator-Logo unterm LearnSphere-Brand: Pfad aus der Upload-API */
  logo: string | null;
}

/** Entspricht dem bisherigen, fest verdrahteten LearnSphere-Design. */
export const DEFAULT_CERTIFICATE_THEME: CertificateTheme = {
  font: "elegant",
  frame: "single",
  layout: "center",
  orientation: "landscape",
  showScore: true,
  signatureName: "",
  signatureRole: "",
  logo: null,
};

const SIGNATURE_MAX_LENGTH = 60;

/**
 * Nur Dateien aus der eigenen Upload-Pipeline (moderiert, PNG/JPG – die
 * einzigen Formate, die der PDF-Renderer versteht), keine Fremd-URLs.
 */
export function isValidLogoPath(value: string): boolean {
  return /^\/uploads\/[A-Za-z0-9-]+\/[A-Za-z0-9]+\.(?:png|jpg)$/.test(value);
}

function parseSignatureText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, SIGNATURE_MAX_LENGTH);
}

function parseOption<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Beliebigen Input (Json-Spalte, Client-Payload) tolerant in ein gültiges
 * Theme überführen: unbekannte Werte fallen feldweise auf den Default zurück.
 */
export function parseCertificateTheme(value: unknown): CertificateTheme {
  const raw =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const d = DEFAULT_CERTIFICATE_THEME;

  return {
    font: parseOption(
      raw.font,
      Object.keys(CERTIFICATE_FONTS) as CertificateFontId[],
      d.font
    ),
    frame: parseOption(raw.frame, CERTIFICATE_FRAMES, d.frame),
    layout: parseOption(raw.layout, CERTIFICATE_LAYOUTS, d.layout),
    orientation: parseOption(
      raw.orientation,
      CERTIFICATE_ORIENTATIONS,
      d.orientation
    ),
    showScore: typeof raw.showScore === "boolean" ? raw.showScore : d.showScore,
    signatureName: parseSignatureText(raw.signatureName),
    signatureRole: parseSignatureText(raw.signatureRole),
    logo:
      typeof raw.logo === "string" && isValidLogoPath(raw.logo)
        ? raw.logo
        : null,
  };
}

