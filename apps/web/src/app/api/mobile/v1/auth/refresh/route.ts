import type { NextRequest } from "next/server";
import { refreshRequestSchema } from "@elearning/api-contracts/mobile/v1/auth";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { rotateMobileSession } from "@/lib/services/mobile-sessions";

/** Refresh-Token einlösen (Rotation mit Reuse-Detection). */
export async function POST(request: NextRequest): Promise<Response> {
  const body = await parseJsonBody(request, refreshRequestSchema);
  if (!body.ok) return body.response;

  // Grobe Bremse pro Client-IP – die eigentliche Sicherheit liegt in der
  // Rotation (jeder Token ist nur einmal einlösbar).
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (
    !(await checkRateLimit(`mobile-refresh:${ip}`, {
      limit: 30,
      windowMs: 10 * 60 * 1000,
    }))
  ) {
    return jsonError("rate_limited", 429);
  }

  const result = await rotateMobileSession(body.data.refreshToken);
  if (!result.ok) {
    return jsonError(result.error, 401);
  }
  return jsonResponse(result.tokens);
}
