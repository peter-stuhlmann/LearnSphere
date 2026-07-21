import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { revokeAllMobileSessions } from "@/lib/services/mobile-sessions";

/**
 * Logout überall: alle Mobile-Sessions widerrufen. Sensible Route →
 * zusätzlich prüfen, dass die Session des Tokens selbst noch gültig ist
 * (strict; gleicht die 15-min-Revocation-Latenz des stateless JWT aus).
 */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const session = await db.mobileSession.findUnique({
    where: { id: auth.sessionId },
    select: { revokedAt: true },
  });
  if (!session || session.revokedAt) {
    return jsonError("unauthorized", 401);
  }

  await revokeAllMobileSessions(auth.userId);
  return jsonResponse({ ok: true });
}
