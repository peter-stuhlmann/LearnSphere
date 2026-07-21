/**
 * Curriculum-Snapshot fürs Zertifikat: Beim Ausstellen wird der damalige
 * Kursinhalt (Abschnitte + Lektionstitel) eingefroren und am Zertifikat
 * gespeichert. Die öffentliche Verifikations-Seite zeigt so den Stand zum
 * Zeitpunkt des Abschlusses – auch wenn der Creator den Kurs später ändert.
 */

export interface CurriculumSection {
  title: string;
  lessons: string[];
}

export type CurriculumSnapshot = CurriculumSection[];

/** Kursinhalt zum Ausstellungszeitpunkt einfrieren (sortiert nach order). */
export function buildCurriculumSnapshot(
  sections: {
    title: string;
    order: number;
    lessons: { title: string; order: number }[];
  }[]
): CurriculumSnapshot {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      title: section.title,
      lessons: [...section.lessons]
        .sort((a, b) => a.order - b.order)
        .map((lesson) => lesson.title),
    }));
}

/**
 * Snapshot aus der Json-Spalte lesen; null bei fehlenden/kaputten Daten
 * (dann zeigt die Verifikations-Seite den aktuellen Kursstand mit Hinweis).
 */
export function parseCurriculumSnapshot(
  value: unknown
): CurriculumSnapshot | null {
  if (!Array.isArray(value)) return null;
  const valid = value.every(
    (entry) =>
      entry !== null &&
      typeof entry === "object" &&
      typeof (entry as { title?: unknown }).title === "string" &&
      Array.isArray((entry as { lessons?: unknown }).lessons) &&
      ((entry as { lessons: unknown[] }).lessons as unknown[]).every(
        (lesson) => typeof lesson === "string"
      )
  );
  if (!valid) return null;
  return (value as { title: string; lessons: string[] }[]).map((entry) => ({
    title: entry.title,
    lessons: [...entry.lessons],
  }));
}
