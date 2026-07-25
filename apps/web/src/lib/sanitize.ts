import sanitizeHtml from "sanitize-html";

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
    "code",
    "pre",
    "mark",
    "span",
  ],
  allowedAttributes: {
    a: ["href", "rel"],
    // @Mentions aus dem Editor: <span class="mention" data-…>@Name</span>
    span: ["class", "data-type", "data-id", "data-label"],
  },
  allowedClasses: {
    span: ["mention"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: "noopener noreferrer",
      },
    }),
  },
};

/**
 * Allowlist für Rich-Text aus dem TipTap-Editor. Alles andere
 * (Skripte, iframes, Bilder, Event-Handler, Styles) wird entfernt.
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_OPTIONS);
}

/**
 * Variante für Creator-Mails: erlaubt zusätzlich die Block-Platzhalter des
 * E-Mail-Editors (Kurs-Grid, Bild-Grid, CTA) als leere <div data-type=…>.
 * Die Platzhalter werden beim Rendern (creator-emails.ts) in E-Mail-sicheres
 * Tabellen-Markup übersetzt – Attributinhalte werden dort erneut geprüft.
 */
export function sanitizeEmailRichText(html: string): string {
  return sanitizeHtml(html, {
    ...RICH_TEXT_OPTIONS,
    allowedTags: [...(RICH_TEXT_OPTIONS.allowedTags as string[]), "div"],
    allowedAttributes: {
      ...RICH_TEXT_OPTIONS.allowedAttributes,
      div: [
        "data-type",
        "data-columns",
        "data-courses",
        "data-images",
        "data-label",
        "data-url",
      ],
    },
  });
}
