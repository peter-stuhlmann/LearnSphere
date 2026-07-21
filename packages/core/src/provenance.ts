/**
 * Herkunfts-Kennzeichnung von Lerninhalten (Texte, Übersetzungen):
 * Jeder TEXT-/HTML-Block trägt eine Herkunft, die Lernenden als Fußnote
 * angezeigt wird (Transparenz im Sinne von Art. 50 KI-VO).
 *
 * - HUMAN               von Menschen erstellt (Standard)
 * - HUMAN_AI_ASSISTED   von Menschen erstellt, mit KI-Unterstützung
 * - AI                  KI-generiert
 * - AI_EDITED           KI-generiert, vom Menschen angepasst
 * - AI_REVIEWED         KI-generiert, menschlich geprüft (Creator bestätigt)
 */

export const CONTENT_PROVENANCES = [
  "HUMAN",
  "HUMAN_AI_ASSISTED",
  "AI",
  "AI_EDITED",
  "AI_REVIEWED",
] as const;

export type ContentProvenance = (typeof CONTENT_PROVENANCES)[number];

/** Unbekannte/fehlende Werte fallen auf HUMAN zurück (Bestandsinhalte). */
export function parseProvenance(value: unknown): ContentProvenance {
  return CONTENT_PROVENANCES.includes(value as ContentProvenance)
    ? (value as ContentProvenance)
    : "HUMAN";
}

/**
 * Automatische Umstufung beim Bearbeiten: Wer einen KI-generierten
 * (auch bereits geprüften) Text ändert, macht ihn zu "KI, vom Menschen
 * angepasst". Menschliche Herkunft bleibt unverändert.
 */
export function provenanceAfterEdit(
  current: ContentProvenance
): ContentProvenance {
  return current === "AI" || current === "AI_REVIEWED" ? "AI_EDITED" : current;
}

/** Steckt KI-generierter Inhalt drin? (maschinenlesbare Kennzeichnung) */
export function isAiGenerated(provenance: ContentProvenance): boolean {
  return (
    provenance === "AI" ||
    provenance === "AI_EDITED" ||
    provenance === "AI_REVIEWED"
  );
}
