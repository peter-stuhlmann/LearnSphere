import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "./env";

/**
 * Access-Tokens der Mobile-App: kurzlebige HS256-JWTs (15 min), signiert mit
 * MOBILE_JWT_SECRET (getrennt vom Web-AUTH_SECRET). Die Verifikation ist
 * stateless (kein DB-Zugriff) – Widerruf wirkt darum spätestens nach Ablauf;
 * sensible Routen prüfen die MobileSession zusätzlich in der DB ("strict").
 */

export const ACCESS_TOKEN_TTL_S = 15 * 60;
export const MOBILE_JWT_ISSUER = "learnsphere-mobile";

export interface MobileTokenPayload {
  userId: string;
  role: string;
  /** MobileSession-ID – für Logout/strict-Prüfung */
  sessionId: string;
}

/** Signatur-Secret aus der Env; wirft bei fehlender Konfiguration. */
export function mobileJwtSecret(): Uint8Array {
  const secret = getEnv().MOBILE_JWT_SECRET;
  if (!secret) {
    throw new Error("MOBILE_JWT_SECRET ist nicht konfiguriert");
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  payload: MobileTokenPayload,
  options: { secret: Uint8Array; now?: Date }
): Promise<{ token: string; expiresAt: number }> {
  const nowMs = (options.now ?? new Date()).getTime();
  const expiresAt = nowMs + ACCESS_TOKEN_TTL_S * 1000;
  const token = await new SignJWT({ role: payload.role, sid: payload.sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuer(MOBILE_JWT_ISSUER)
    .setIssuedAt(Math.floor(nowMs / 1000))
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(options.secret);
  return { token, expiresAt };
}

export async function verifyAccessToken(
  token: string,
  secret: Uint8Array
): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: MOBILE_JWT_ISSUER,
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.sid !== "string") return null;
    return {
      userId: payload.sub,
      role: typeof payload.role === "string" ? payload.role : "CLIENT",
      sessionId: payload.sid,
    };
  } catch {
    return null;
  }
}

/** "Authorization: Bearer <token>" → Token oder null. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  return match ? match[1].trim() : null;
}

export type MobileAuthResult =
  | { ok: true; userId: string; role: string; sessionId: string }
  | { ok: false; status: 401; error: "unauthorized" };

/**
 * Bearer-Auth für Mobile-Routen (stateless). `secret` ist injizierbar für
 * Tests; Standard ist das Env-Secret.
 */
export async function authenticateMobileRequest(
  request: { headers: { get(name: string): string | null } },
  secret: Uint8Array = mobileJwtSecret()
): Promise<MobileAuthResult> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return { ok: false, status: 401, error: "unauthorized" };
  const payload = await verifyAccessToken(token, secret);
  if (!payload) return { ok: false, status: 401, error: "unauthorized" };
  return { ok: true, ...payload };
}
