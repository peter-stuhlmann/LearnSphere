import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

export const API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
} as const;

export type ApiAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: "unauthorized" | "api_plan_required" };

/** Ein API-Plan gilt bei aktivem Abo; PAST_DUE = Kulanzfenster. */
export function isApiPlanUsable(
  status: "ACTIVE" | "PAST_DUE" | "CANCELED" | undefined | null
): boolean {
  return status === "ACTIVE" || status === "PAST_DUE";
}

/**
 * Prüft den Bearer-Token und den API-Plan des Key-Inhabers.
 * Der API-Zugriff ist ein kostenpflichtiges Feature (25 €/Monat).
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(ls_[0-9a-f]{64})$/i);
  if (!match) return { ok: false, status: 401, error: "unauthorized" };

  const key = await db.apiKey.findUnique({
    where: { keyHash: hashToken(match[1]) },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      user: { select: { apiSubscription: { select: { status: true } } } },
    },
  });
  if (!key || key.revokedAt) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  if (!isApiPlanUsable(key.user.apiSubscription?.status)) {
    return { ok: false, status: 403, error: "api_plan_required" };
  }

  // lastUsedAt aktualisieren, ohne die Antwort zu verzögern
  db.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { ok: true, userId: key.userId };
}
