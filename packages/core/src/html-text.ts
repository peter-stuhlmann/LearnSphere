/** Rich-Text (RTE-HTML) in Klartext überführen – plattformneutral, wird
 *  von Vorlesen (TTS), Selbsttests und KI-Features gemeinsam genutzt. */
export function htmlToPlainText(html: string): string {
  return (
    html
      // Script/Style samt Inhalt verwerfen
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      // Block-Grenzen als Absatz markieren
      .replace(/<(?:\/p|\/li|\/h[1-6]|\/div|\/blockquote|br\s*\/?)>/gi, "\n\n")
      // restliche Tags entfernen
      .replace(/<[^>]+>/g, "")
      // gängige Entities
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;/g, "'")
      // Whitespace: innerhalb von Absätzen kollabieren, Absätze erhalten
      .split(/\n{2,}|\r\n{2,}/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter((paragraph) => paragraph.length > 0)
      .join("\n\n")
  );
}
