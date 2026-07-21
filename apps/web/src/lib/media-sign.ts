import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "./env";

/**
 * Signierte Medien-URLs für die Mobile-App: Native Video-Player (AVPlayer/
 * ExoPlayer) verlieren eigene Auth-Header bei Range-Re-Requests – daher
 * bekommt die App kurzlebige, HMAC-signierte URLs. Die Berechtigung
 * (Einschreibung) wird beim SIGNIEREN geprüft (Lesson-Endpoint), die
 * Streaming-Route validiert nur noch Signatur + Ablauf.
 */

export const MEDIA_SIGN_TTL_MS = 10 * 60 * 1000;

/** Secret aus der Env (Fallback: MOBILE_JWT_SECRET); wirft ohne Konfiguration. */
export function mediaSignSecret(): string {
  const env = getEnv();
  const secret = env.MEDIA_SIGN_SECRET ?? env.MOBILE_JWT_SECRET;
  if (!secret) {
    throw new Error("MEDIA_SIGN_SECRET/MOBILE_JWT_SECRET ist nicht konfiguriert");
  }
  return secret;
}

export function mediaSignature(
  path: string,
  expiresAtMs: number,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(`${path}|${expiresAtMs}`)
    .digest("hex");
}

/** Pfad (z. B. /api/media/v/u1/a.mp4) → Pfad mit se/st-Query, 10 min gültig. */
export function signedMediaUrl(
  path: string,
  secret: string,
  now: Date = new Date()
): string {
  const expiresAt = now.getTime() + MEDIA_SIGN_TTL_MS;
  return `${path}?se=${expiresAt}&st=${mediaSignature(path, expiresAt, secret)}`;
}

/**
 * Signatur einer eingehenden Anfrage prüfen. Ablauf zählt nur beim
 * Stream-Open – eine bereits offene Verbindung läuft weiter.
 */
export function verifyMediaSignature(input: {
  path: string;
  se: string | null;
  st: string | null;
  secret: string;
  now?: Date;
}): boolean {
  if (!input.se || !input.st) return false;
  if (!/^\d{1,16}$/.test(input.se)) return false;
  const expiresAt = Number(input.se);
  if ((input.now ?? new Date()).getTime() > expiresAt) return false;

  const expected = mediaSignature(input.path, expiresAt, input.secret);
  const given = Buffer.from(input.st, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
