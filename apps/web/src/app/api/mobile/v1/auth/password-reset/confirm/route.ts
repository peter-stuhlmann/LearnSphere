import type { NextRequest } from "next/server";
import { passwordResetConfirmSchema } from "@elearning/api-contracts/mobile/v1/auth";
import { resetPassword } from "@/app/actions/auth-actions";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { revokeAllMobileSessions } from "@/lib/services/mobile-sessions";

/** Neues Passwort setzen; alle Mobile-Sessions des Kontos widerrufen. */
export async function POST(request: NextRequest): Promise<Response> {
  const body = await parseJsonBody(request, passwordResetConfirmSchema);
  if (!body.ok) return body.response;

  // userId vor dem Einlösen merken – danach ist der Token verbraucht
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(body.data.token) },
    select: { userId: true },
  });

  const result = await resetPassword(body.data);
  if (!result.ok) {
    if (result.error === "token_invalid") {
      return jsonError("token_invalid", 400);
    }
    return jsonError("validation_failed", 400, [result.error ?? "invalid"]);
  }

  if (record) {
    await revokeAllMobileSessions(record.userId);
  }
  return jsonResponse({ ok: true });
}
