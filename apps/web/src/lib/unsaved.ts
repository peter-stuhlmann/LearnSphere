/**
 * Winziger globaler Store für "ungespeicherte Änderungen": Formulare melden
 * sich mit einer ID an/ab, der UnsavedChangesGuard im Layout warnt beim
 * Verlassen der Seite, solange mindestens ein Formular Änderungen hat.
 */

const dirtyIds = new Set<string>();
const listeners = new Set<() => void>();

/** Meldet für eine Formular-ID, ob es ungespeicherte Änderungen gibt. */
export function markUnsaved(id: string, dirty: boolean): void {
  if (dirty === dirtyIds.has(id)) return;
  if (dirty) {
    dirtyIds.add(id);
  } else {
    dirtyIds.delete(id);
  }
  for (const listener of listeners) listener();
}

/** Hat irgendein Formular gerade ungespeicherte Änderungen? */
export function isAnyUnsaved(): boolean {
  return dirtyIds.size > 0;
}

/** Änderungs-Abo für useSyncExternalStore; gibt die Abmelde-Funktion zurück. */
export function subscribeUnsaved(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
