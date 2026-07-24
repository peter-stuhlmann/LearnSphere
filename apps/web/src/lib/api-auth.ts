import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { hasApiAccess } from "@/lib/api-access";
import { checkRateLimit } from "@/lib/rate-limit";

export const API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
} as const;

export type ApiAuthResult =
  | { ok: true; userId: string; keyId: string }
  | {
      ok: false;
      status: 401 | 403 | 429;
      error: "unauthorized" | "api_plan_required" | "rate_limited";
    };

// Weiterhin von hier exportiert – die Aufrufer kennen diesen Ort
export { isApiPlanUsable, hasApiAccess } from "@/lib/api-access";

/** Bearer-Header parsen: exakt ein Key im Format ls_<64 hex>. */
export function parseBearerApiKey(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(ls_[0-9a-f]{64})$/i);
  return match ? match[1] : null;
}

/** Budget je Minute – Checkout ist bewusst knapper als Lese-Zugriffe. */
export interface ApiRateBudget {
  name: string;
  limit: number;
}

export const API_READ_BUDGET: ApiRateBudget = { name: "read", limit: 120 };
export const API_CHECKOUT_BUDGET: ApiRateBudget = {
  name: "checkout",
  limit: 20,
};

/**
 * Prüft den Bearer-Token, den API-Plan des Key-Inhabers und das
 * Anfrage-Budget. Der API-Zugriff ist ein kostenpflichtiges Feature
 * (25 €/Monat); das Rate-Limit zählt je Key und Minute.
 */
export async function authenticateApiRequest(
  request: NextRequest,
  budget: ApiRateBudget = API_READ_BUDGET
): Promise<ApiAuthResult> {
  const plainKey = parseBearerApiKey(request);
  if (!plainKey) return { ok: false, status: 401, error: "unauthorized" };

  const key = await db.apiKey.findUnique({
    where: { keyHash: hashToken(plainKey) },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      user: {
        select: { role: true, apiSubscription: { select: { status: true } } },
      },
    },
  });
  if (!key || key.revokedAt) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  if (
    !hasApiAccess({
      role: key.user.role,
      status: key.user.apiSubscription?.status,
    })
  ) {
    return { ok: false, status: 403, error: "api_plan_required" };
  }

  if (
    !(await checkRateLimit(`creator-api:${budget.name}:${key.id}`, {
      limit: budget.limit,
      windowMs: 60_000,
    }))
  ) {
    return { ok: false, status: 429, error: "rate_limited" };
  }

  // lastUsedAt aktualisieren, ohne die Antwort zu verzögern
  db.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { ok: true, userId: key.userId, keyId: key.id };
}

/** 429-Antworten sagen, wann sich ein Retry lohnt (Fenster: 60 s). */
export function retryAfterHeaders(
  status: number
): Record<string, string> {
  return status === 429 ? { "Retry-After": "60" } : {};
}
