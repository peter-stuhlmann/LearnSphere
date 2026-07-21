/** Grobe Heuristik: beginnt der Inhalt mit einem Tag, ist es HTML. */
export function isProbablyHtml(value: string): boolean {
  return /^\s*<[a-zA-Z]/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Konvertiert Altbestand (Plain-Text mit Zeilenumbrüchen) in HTML:
 * Doppelte Umbrüche werden Absätze, einfache werden <br>.
 */
export function plainTextToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Liefert immer HTML – Plain-Text-Altbestand wird konvertiert. */
export function ensureHtml(value: string): string {
  return isProbablyHtml(value) ? value : plainTextToHtml(value);
}
