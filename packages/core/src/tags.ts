/**
 * Kurs-Tags: frei vom Creator vergeben, gespeichert als normalisierter,
 * kommagetrennter String (z. B. "react,frontend,hooks") – so bleibt die
 * Suche eine einfache contains-Abfrage.
 */

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

/** Einzelnen Tag normalisieren: trimmen, Kleinschreibung, Innen-Whitespace zu "-". */
export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-+#.]/gu, "")
    .slice(0, MAX_TAG_LENGTH);
}

/** Liste normalisieren: leere raus, Duplikate raus, auf MAX_TAGS begrenzen. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (tag) seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen];
}

/** Für die DB: "react,frontend" – leer wenn keine Tags. */
export function serializeTags(tags: string[]): string {
  return normalizeTags(tags).join(",");
}

/** Aus der DB zurück in eine Liste. */
export function parseTags(serialized: string): string[] {
  if (!serialized) return [];
  return serialized.split(",").filter(Boolean);
}
