import type { NextRequest } from "next/server";
import { registerRequestSchema } from "@elearning/api-contracts/mobile/v1/auth";
import { registerUser } from "@/app/actions/auth-actions";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { verifyCredentials } from "@/lib/services/auth-service";
import { issueMobileSession } from "@/lib/services/mobile-sessions";

/** Registrierung + Auto-Login (Token-Paar in einer Antwort). */
export async function POST(request: NextRequest): Promise<Response> {
  const body = await parseJsonBody(request, registerRequestSchema);
  if (!body.ok) return body.response;

  const registered = await registerUser(body.data);
  if (!registered.ok) {
    switch (registered.error) {
      case "terms_required":
        return jsonError("terms_required", 400);
      case "email_taken":
        return jsonError("email_taken", 409);
      case "too_many_attempts":
        return jsonError("too_many_attempts", 429);
      default:
        return jsonError("validation_failed", 400, [
          registered.error ?? "invalid",
        ]);
    }
  }

  const login = await verifyCredentials({
    email: body.data.email,
    password: body.data.password,
  });
  /* Direkt nach dem Anlegen kann nur ein paralleler Passwort-Wechsel o. Ä.
     fehlschlagen – dann meldet sich die App regulär an. */
  if (!login.ok) {
    return jsonResponse({ ok: true }, 201);
  }
  const tokens = await issueMobileSession(login.user, body.data.device);
  return jsonResponse({ ...tokens, user: login.user }, 201);
}
