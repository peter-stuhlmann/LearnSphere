/**
 * URL-Schema geschützter Kursmedien: Hochgeladene Videos liegen NICHT unter
 * public/, sondern werden über die Streaming-Route /api/media/v/<userId>/<datei>
 * ausgeliefert (Berechtigungsprüfung + Range-Support in apps/web). Hier leben
 * nur die plattformneutralen URL-Helfer – Dateisystem-Auflösung bleibt im Web.
 */

export const PROTECTED_VIDEO_PREFIX = "/api/media/v/";

/** userId (cuid) und Dateiname (hex + Endung) – bewusst eng gefasst,
    damit Traversal ("..", Slashes, Sonderzeichen) strukturell unmöglich ist */
const PROTECTED_URL_RE =
  /^\/api\/media\/v\/([A-Za-z0-9]+)\/([A-Za-z0-9-]+\.[A-Za-z0-9]+)$/;

export interface ProtectedVideoRef {
  userId: string;
  file: string;
}

export function isProtectedVideoUrl(url: string): boolean {
  return PROTECTED_URL_RE.test(url);
}

export function parseProtectedVideoUrl(url: string): ProtectedVideoRef | null {
  const match = PROTECTED_URL_RE.exec(url);
  if (!match) return null;
  return { userId: match[1], file: match[2] };
}

export function protectedVideoUrl(userId: string, file: string): string {
  return `${PROTECTED_VIDEO_PREFIX}${userId}/${file}`;
}

/** true für alle lokal gespeicherten Medien (öffentlich oder geschützt) */
export function isLocalUploadUrl(url: string): boolean {
  return url.startsWith("/uploads/") || isProtectedVideoUrl(url);
}
