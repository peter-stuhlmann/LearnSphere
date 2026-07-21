import { generateToken, isExpired } from "./tokens";

/**
 * Refresh-Token-Policy der Mobile-App: opake Tokens (nur Hash in der DB),
 * Rotation bei jedem Refresh, gleitendes 60-Tage-Fenster. Rotierte Zeilen
 * bleiben (revokedAt gesetzt) – taucht ihr Token erneut auf, ist das ein
 * Diebstahl-Indiz und die ganze familyId wird widerrufen.
 * Hier nur die pure Entscheidungslogik; DB-Zugriffe liegen in den Routen.
 */

export const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 Tage

export function generateRefreshToken(): string {
  return generateToken();
}

export function refreshExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
}

export interface RefreshRecord {
  revokedAt: Date | null;
  expiresAt: Date;
}

export type RefreshDecision =
  /** Token unbekannt → generisch ablehnen */
  | { action: "reject"; reason: "unknown" }
  /** Token gehört zu einer bereits rotierten/widerrufenen Zeile →
      Reuse-Verdacht, ganze Familie widerrufen */
  | { action: "revoke_family"; reason: "reuse" }
  /** abgelaufen → ablehnen (Familie bleibt unangetastet) */
  | { action: "reject"; reason: "expired" }
  /** gültig → rotieren (alte Zeile widerrufen, neue ausstellen) */
  | { action: "rotate" };

export function evaluateRefresh(
  record: RefreshRecord | null,
  now: Date = new Date()
): RefreshDecision {
  if (!record) return { action: "reject", reason: "unknown" };
  if (record.revokedAt) return { action: "revoke_family", reason: "reuse" };
  if (isExpired(record.expiresAt, now)) {
    return { action: "reject", reason: "expired" };
  }
  return { action: "rotate" };
}
