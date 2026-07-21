import crypto from "node:crypto";
import { z } from "zod";
import { TERMINE_BASE_URL } from "./termine";

/**
 * "Mit termine.lol verbinden": OAuth-artiger Connect-Flow statt manuellem
 * API-Key. Wir schicken den Creator zur termine.lol-Consent-Seite; nach
 * Zustimmung tauscht unser Callback den Einmal-Code serverseitig gegen
 * Kalender-ID + API-Key am Creator-Konto. Der state ist HMAC-signiert
 * (User, Locale, Rücksprungziel, Ablauf) und zusätzlich per Cookie ans
 * Browser-Profil gebunden (CSRF). Trennen widerruft den Key drüben.
 */

export const TERMINE_TOKEN_URL = `${TERMINE_BASE_URL}/api/connect/token`;
export const TERMINE_REVOKE_URL = `${TERMINE_BASE_URL}/api/connect/revoke`;

/** Name des CSRF-Cookies, das den state an den Browser bindet. */
export const CONNECT_STATE_COOKIE = "termine_connect_state";

/** Der Creator hat 10 Minuten für Login + Zustimmung drüben. */
const STATE_TTL_MS = 10 * 60 * 1000;

export interface ConnectStatePayload {
  userId: string;
  locale: string;
  /** Relativer Pfad, zu dem der Callback zurückführt (Editor/Einstellungen) */
  returnTo: string;
  exp: number;
}

/**
 * Rücksprungziel absichern: nur relative Pfade innerhalb der App, kein
 * Open Redirect über "//host" oder absolute URLs.
 */
export function sanitizeReturnTo(value: string | null, fallback: string): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return fallback;
}

function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/** Signierten state für den Hinweg erzeugen (User/Locale/Ziel + Ablauf). */
export function createConnectState(
  input: { userId: string; locale: string; returnTo: string },
  secret: string,
  now: number = Date.now()
): string {
  const payload: ConnectStatePayload = { ...input, exp: now + STATE_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

const statePayloadSchema = z.object({
  userId: z.string().min(1),
  locale: z.string().min(1),
  returnTo: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("/") && !value.startsWith("//")),
  exp: z.number(),
});

/** state aus dem Callback prüfen: Signatur, Struktur, Ablauf. */
export function verifyConnectState(
  state: string,
  secret: string,
  now: number = Date.now()
): ConnectStatePayload | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = state.slice(0, dot);
  const sig = state.slice(dot + 1);

  const expected = Buffer.from(sign(encoded, secret));
  const actual = Buffer.from(sig);
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  ) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const parsed = statePayloadSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (parsed.data.exp <= now) return null;
  return parsed.data;
}

/** Consent-Seite bei termine.lol (locale-präfixiert wie deren Routing). */
export function buildConnectAuthorizeUrl(options: {
  locale: string;
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(`${TERMINE_BASE_URL}/${options.locale}/connect`);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  return url.toString();
}

const tokenResponseSchema = z.object({
  calendarId: z.string().min(1),
  apiKey: z.string().min(1),
});

export type ConnectTokenResult = z.infer<typeof tokenResponseSchema>;

/** Antworten kommen als `{ data: … }`-Hülle – transparent auspacken. */
export function parseConnectTokenResponse(
  raw: unknown
): ConnectTokenResult | null {
  if (raw && typeof raw === "object" && "data" in raw) {
    raw = (raw as { data: unknown }).data;
  }
  const parsed = tokenResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
