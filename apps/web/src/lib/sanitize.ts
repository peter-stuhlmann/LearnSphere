import sanitizeHtml from "sanitize-html";

/**
 * Allowlist für Rich-Text aus dem TipTap-Editor. Alles andere
 * (Skripte, iframes, Bilder, Event-Handler, Styles) wird entfernt.
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
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
  });
}
