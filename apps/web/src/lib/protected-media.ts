import path from "node:path";
import {
  parseProtectedVideoUrl,
  type ProtectedVideoRef,
} from "@elearning/core/media-url";
import { protectedUploadsDir, publicUploadsDir } from "@/lib/storage";

/**
 * Geschützte Video-Auslieferung (Server-Seite): URL-Schema und -Parsing leben
 * in @elearning/core/media-url; hier nur die Dateisystem-Auflösung und
 * HTTP-Streaming-Helfer für die Route /api/media/v/<userId>/<datei>.
 */

/** Absoluter Dateipfad eines geschützten Videos (PROTECTED_UPLOADS_DIR). */
export function protectedVideoFsPath(
  cwd: string,
  ref: ProtectedVideoRef
): string {
  return path.join(protectedUploadsDir(cwd), ref.userId, ref.file);
}

/**
 * Dateipfad eines EIGENEN Uploads (öffentlich oder geschützt) – null bei
 * fremdem Besitzer, Traversal oder unbekanntem Schema. Für serverseitige
 * Verarbeitung wie Transkription.
 */
export function ownedMediaFsPath(
  relativeUrl: string,
  userId: string,
  cwd: string
): string | null {
  const publicPrefix = `/uploads/${userId}/`;
  if (relativeUrl.startsWith(publicPrefix) && !relativeUrl.includes("..")) {
    return path.join(
      publicUploadsDir(cwd),
      relativeUrl.slice("/uploads/".length)
    );
  }
  const ref = parseProtectedVideoUrl(relativeUrl);
  if (ref && ref.userId === userId) {
    return protectedVideoFsPath(cwd, ref);
  }
  return null;
}

export interface ByteRange {
  start: number;
  end: number;
}

/**
 * HTTP-Range-Header ("bytes=a-b", "bytes=a-", "bytes=-n") auf eine gültige,
 * auf die Dateigröße begrenzte Spanne parsen. null = kein/ungültiger Range
 * (Aufrufer liefert dann die ganze Datei bzw. 416 bei size 0).
 */
export function parseRangeHeader(
  header: string | null,
  size: number
): ByteRange | null {
  if (!header || size <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;

  // Suffix-Range: die letzten n Bytes
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(rawStart);
  if (start >= size) return null;
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (end < start) return null;
  return { start, end };
}

/** Content-Type anhand der Dateiendung (nur Video-Formate der Upload-Route) */
export function videoContentType(file: string): string {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}
