import type { NextRequest } from "next/server";
import { passwordResetRequestSchema } from "@elearning/api-contracts/mobile/v1/auth";
import { requestPasswordReset } from "@/app/actions/auth-actions";
import { jsonResponse, parseJsonBody } from "@/lib/mobile/http";

/**
 * Passwort-Reset anstoßen. Antwortet immer mit ok (keine Konto-Enumeration);
 * Mail-Versand, Token und Rate-Limit übernimmt die bestehende Action.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const body = await parseJsonBody(request, passwordResetRequestSchema);
  if (!body.ok) return body.response;

  await requestPasswordReset(body.data);
  return jsonResponse({ ok: true });
}
