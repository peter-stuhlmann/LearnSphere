import type { NextRequest } from "next/server";
import { loginRequestSchema } from "@elearning/api-contracts/mobile/v1/auth";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { verifyCredentials } from "@/lib/services/auth-service";
import { issueMobileSession } from "@/lib/services/mobile-sessions";

/**
 * Mobile-Login: E-Mail + Passwort (+ optional TOTP). Bei aktivierter 2FA
 * ohne TOTP-Code antwortet die Route mit 202 – die App fragt den Code ab
 * und wiederholt den Request mit identischem Body plus totp.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const body = await parseJsonBody(request, loginRequestSchema);
  if (!body.ok) return body.response;

  const result = await verifyCredentials(body.data);
  if (!result.ok) {
    switch (result.error) {
      case "too_many_attempts":
        return jsonError("too_many_attempts", 429);
      case "2fa_required":
        return jsonError("2fa_required", 202);
      case "2fa_invalid":
        return jsonError("2fa_invalid", 401);
      default:
        return jsonError("invalid_credentials", 401);
    }
  }

  const tokens = await issueMobileSession(result.user, body.data.device);
  return jsonResponse({ ...tokens, user: result.user });
}
