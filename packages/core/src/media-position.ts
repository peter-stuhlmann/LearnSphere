/**
 * Exakte Wiedergabe-Position je Medienblock ("Video bei 4:32 fortsetzen").
 * Gespeichert als JSON an LessonProgress: { [blockId]: sekunden }.
 * Getrennt vom Sehfortschritt (watchedSeconds), der monoton wächst –
 * die Position ist dagegen einfach der letzte Stand.
 */

/** Puffer an den Rändern: knapp am Anfang/Ende lohnt kein Wiedereinstieg */
export const RESUME_EDGE_SECONDS = 5;

/** DB-Json → validierte Positions-Map (unbekannte Formen → leer). */
export function parsePositions(json: unknown): Record<string, number> {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return {};
  }
  const result: Record<string, number> = {};
  for (const [blockId, value] of Object.entries(json)) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      result[blockId] = Math.floor(value);
    }
  }
  return result;
}

/** Bestehende Map mit neuen Positionen zusammenführen (neuer Stand gewinnt). */
export function mergePositions(
  existing: unknown,
  updates: Record<string, number>
): Record<string, number> {
  return { ...parsePositions(existing), ...parsePositions(updates) };
}

/**
 * Einstiegs-Position fürs Abspielen: nur mitten im Medium fortsetzen.
 * Ganz am Anfang (< Puffer) oder kurz vor Schluss startet das Medium
 * regulär bei 0 – dort wäre ein Sprung nur irritierend.
 */
export function resumePosition(
  saved: number | undefined,
  durationSeconds: number
): number {
  if (!saved || saved < RESUME_EDGE_SECONDS) return 0;
  if (
    durationSeconds > 0 &&
    saved > durationSeconds - RESUME_EDGE_SECONDS
  ) {
    return 0;
  }
  return Math.floor(saved);
}
