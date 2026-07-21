import path from "node:path";

/**
 * Ablageorte für Uploads. Im Dev liegen sie im Projekt (public/uploads bzw.
 * uploads-protected); im Docker-Deployment zeigen UPLOADS_DIR und
 * PROTECTED_UPLOADS_DIR auf persistente Volumes außerhalb des Images.
 * Ausgeliefert werden öffentliche Uploads über die Route /uploads/[...path]
 * – Next serviert zur Laufzeit hinzugekommene public/-Dateien in Produktion
 * nämlich nicht.
 */

/** Wurzelverzeichnis öffentlicher Uploads (Bilder, Audio, Dateien, TTS). */
export function publicUploadsDir(cwd: string = process.cwd()): string {
  const override = process.env.UPLOADS_DIR?.trim();
  return override || path.join(cwd, "public", "uploads");
}

/** Wurzelverzeichnis geschützter Video-Uploads (nur via Streaming-Route). */
export function protectedUploadsDir(cwd: string = process.cwd()): string {
  const override = process.env.PROTECTED_UPLOADS_DIR?.trim();
  return override || path.join(cwd, "uploads-protected");
}

/**
 * URL-Pfadsegmente unterhalb von /uploads/ in einen Dateipfad auflösen.
 * null bei leeren, versteckten oder traversierenden Segmenten.
 */
export function resolvePublicUploadPath(
  segments: string[],
  cwd: string = process.cwd()
): string | null {
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment)) return null;
    if (segment.includes("..")) return null;
  }
  return path.join(publicUploadsDir(cwd), ...segments);
}

/** Content-Type öffentlicher Uploads anhand der Dateiendung. */
export function uploadContentType(file: string): string {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "pdf":
      return "application/pdf";
    case "zip":
      return "application/zip";
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
