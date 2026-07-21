import type { Prisma } from "@prisma/client";
import { normalizeTag } from "@elearning/core/tags";
import { htmlToPlainText } from "@elearning/core/html-text";

/**
 * Flexible Kurssuche (Substring, case-insensitive dank MySQL-Collation):
 * "allo" findet "Hallo", "wel" findet "HalloWelt". Durchsucht Titel,
 * Untertitel, Tags und die Beschreibung. Bewusst LIKE statt FULLTEXT-Index –
 * FULLTEXT matcht nur ganze Wörter und würde die Substring-Semantik brechen;
 * bei Katalog-Größenordnung ist der Scan unkritisch.
 */

export const SEARCH_MIN_CHARS = 3;

/** where-Fragment für Prisma – Titel, Untertitel, Tags, Beschreibung. */
export function courseSearchWhere(query: string): Prisma.CourseWhereInput {
  return {
    OR: [
      { title: { contains: query } },
      { subtitle: { contains: query } },
      // Tags sind normalisiert gespeichert → Suchbegriff mitnormalisieren
      { tags: { contains: normalizeTag(query) } },
      { description: { contains: query } },
    ],
  };
}

export interface SearchableCourse {
  title: string;
  subtitle?: string | null;
  tags?: string | null;
  description?: string | null;
}

/**
 * Nachverifikation eines DB-Treffers: Die Beschreibung ist HTML – ohne
 * diese Prüfung würde z. B. "str" jeden Kurs mit <strong>-Tag finden.
 * Der Vergleich läuft deshalb gegen den reinen Text.
 */
export function matchesCourseText(
  course: SearchableCourse,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (course.title.toLowerCase().includes(q)) return true;
  if (course.subtitle?.toLowerCase().includes(q)) return true;
  if (course.tags && course.tags.toLowerCase().includes(normalizeTag(query))) {
    return true;
  }
  if (!course.description) return false;
  return htmlToPlainText(course.description).toLowerCase().includes(q);
}
