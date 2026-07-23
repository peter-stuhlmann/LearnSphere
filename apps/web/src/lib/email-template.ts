/**
 * Einheitliches E-Mail-Layout im LearnSphere-Design.
 *
 * Aus einem Inhalt entstehen BEIDE Fassungen zugleich – HTML und Klartext.
 * So können sie nicht auseinanderlaufen: Jede Mail hat denselben Wortlaut,
 * egal ob der Client HTML anzeigt oder nur Text.
 *
 * Bewusst tabellenbasiert und mit Inline-Styles: E-Mail-Clients (allen voran
 * Outlook) ignorieren externe Stylesheets, Flexbox und moderne Selektoren.
 * Was hier steht, ist der kleinste gemeinsame Nenner, der überall gleich
 * aussieht. Farben kommen aus den Marken-Tokens.
 *
 * Reine Funktion ohne Seiteneffekte – dadurch testbar.
 */

const COLORS = {
  bgDeep: "#07080F",
  bgElevated: "#12141F",
  text: "#EDEDF2",
  textMuted: "#A7A9BC",
  accent: "#C8FF4D",
  onAccent: "#0B0C15",
  violet: "#8B7CFF",
  border: "#262A3A",
};

/* Systemschrift-Stack für den Fließtext. Ohne font-family fallen Mail-
   Clients auf ihre Standardschrift zurück – häufig Times New Roman. Diese
   Fonts sind auf praktisch jedem Gerät vorhanden, es lädt nichts nach. */
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailContent {
  /** "de" | "en" – steuert nur die festen Bausteine (Footer, Fallback) */
  locale: string;
  /** Vorschautext (Preheader), erscheint in der Mail-Liste neben dem Betreff */
  preview: string;
  heading: string;
  /** Fließtext-Absätze; werden HTML-escaped */
  paragraphs: string[];
  /** großer Call-to-Action-Button */
  button?: EmailButton;
  /** kleiner, gedämpfter Hinweis unter dem Button (z. B. "war das nicht du?") */
  note?: string;
  /** Fußzeilen-Links, etwa Abmelden */
  footerLinks?: EmailButton[];
}

/** Minimales HTML-Escaping für in Text eingebettete Nutzer-/Kursdaten. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Strings {
  fallback: string;
  footer: string;
}

const STRINGS: Record<string, Strings> = {
  de: {
    fallback:
      "Falls der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:",
    footer:
      "Du erhältst diese E-Mail, weil du sie auf LearnSphere ausgelöst hast.",
  },
  en: {
    fallback:
      "If the button doesn't work, copy this address into your browser:",
    footer:
      "You are receiving this email because you triggered it on LearnSphere.",
  },
};

/** Die HTML-Fassung: Wrapper-Tabelle, Wortmarke, Karte, Button, Fußzeile. */
function renderHtml(content: EmailContent, strings: Strings): string {
  const paragraphs = content.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${COLORS.text};">${escapeHtml(
          text
        )}</p>`
    )
    .join("");

  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
         <tr><td style="border-radius:999px;background:${COLORS.accent};">
           <a href="${encodeURI(content.button.url)}"
              style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:${COLORS.onAccent};text-decoration:none;border-radius:999px;">
             ${escapeHtml(content.button.label)}
           </a>
         </td></tr>
       </table>
       <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.textMuted};">${escapeHtml(
         strings.fallback
       )}</p>
       <p style="margin:0 0 18px;font-family:${FONT};font-size:12px;line-height:1.6;word-break:break-all;">
         <a href="${encodeURI(content.button.url)}" style="color:${COLORS.violet};text-decoration:underline;">${escapeHtml(
           content.button.url
         )}</a>
       </p>`
    : "";

  const note = content.note
    ? `<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${COLORS.textMuted};">${escapeHtml(
        content.note
      )}</p>`
    : "";

  const footerLinks =
    content.footerLinks && content.footerLinks.length > 0
      ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:1.6;">${content.footerLinks
          .map(
            (link) =>
              `<a href="${encodeURI(link.url)}" style="color:${COLORS.textMuted};text-decoration:underline;">${escapeHtml(
                link.label
              )}</a>`
          )
          .join(
            ` <span style="color:${COLORS.border};">·</span> `
          )}</p>`
      : "";

  return `<!doctype html>
<html lang="${escapeHtml(content.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bgDeep};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
    content.preview
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bgDeep};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 20px;">
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${COLORS.text};">Learn<span style="color:${COLORS.accent};">Sphere</span></span>
      </td></tr>
      <tr><td style="border:1px solid ${COLORS.border};border-radius:16px;background:${COLORS.bgElevated};padding:32px 28px;">
        <h1 style="margin:0 0 18px;font-family:${FONT};font-size:21px;line-height:1.3;color:${COLORS.text};">${escapeHtml(
          content.heading
        )}</h1>
        ${paragraphs}
        ${button}
        ${note}
      </td></tr>
      <tr><td style="padding:22px 4px 0;">
        ${footerLinks}
        <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.textMuted};">${escapeHtml(
          strings.footer
        )}</p>
        <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;color:${COLORS.textMuted};">© LearnSphere</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Die Klartext-Fassung: gleicher Wortlaut, ohne Auszeichnung. */
function renderText(content: EmailContent, strings: Strings): string {
  const parts: string[] = [content.heading, "", ...content.paragraphs];
  if (content.button) {
    parts.push("", `${content.button.label}:`, content.button.url);
  }
  if (content.note) parts.push("", content.note);
  parts.push("", "—", strings.footer);
  if (content.footerLinks) {
    for (const link of content.footerLinks) {
      parts.push(`${link.label}: ${link.url}`);
    }
  }
  return parts.join("\n");
}

/** Baut HTML- und Klartext-Fassung einer Mail aus einem Inhalt. */
export function buildEmail(content: EmailContent): {
  html: string;
  text: string;
} {
  const strings = STRINGS[content.locale] ?? STRINGS.en;
  return {
    html: renderHtml(content, strings),
    text: renderText(content, strings),
  };
}
