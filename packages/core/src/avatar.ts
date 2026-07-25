/**
 * Harte Obergrenze für die Datei-Auswahl (intern). Bewusst NICHT nach außen
 * kommuniziert: Dem Nutzer wird 2 MB als Richtwert angezeigt (siehe
 * `avatarHint`), damit Bilder klein bleiben – akzeptiert werden aber bis 5 MB.
 */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB (intern, nicht angezeigt)

/** Richtwert, der dem Nutzer angezeigt wird (nur Hinweistext, keine Prüfung). */
export const RECOMMENDED_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Obergrenze fürs gespeicherte Bild: Der Client verkleinert vor dem Upload
 * auf 256×256 (JPEG); da der Avatar als Data-URL im Header JEDER Seite
 * steckt, hält dieser Deckel das HTML klein.
 */
export const MAX_STORED_AVATAR_BYTES = 256 * 1024;

/** Kantenlänge, auf die der Client den Avatar vor dem Upload verkleinert. */
export const AVATAR_SIZE = 256;

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAllowedAvatar(mimeType: string, sizeBytes: number): boolean {
  return (
    ALLOWED_MIME_TYPES.has(mimeType) &&
    sizeBytes > 0 &&
    sizeBytes <= MAX_AVATAR_BYTES
  );
}
