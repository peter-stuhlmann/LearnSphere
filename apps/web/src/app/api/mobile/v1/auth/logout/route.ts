import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { revokeMobileSession } from "@/lib/services/mobile-sessions";

/** Logout dieses Geräts: die Session des Access-Tokens widerrufen. */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  await revokeMobileSession(auth.sessionId);
  return jsonResponse({ ok: true });
}
