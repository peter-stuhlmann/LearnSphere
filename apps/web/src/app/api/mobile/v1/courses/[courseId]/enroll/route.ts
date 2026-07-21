import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { enrollFree } from "@/lib/services/learning-service";

/**
 * Gratis-Einschreibung aus der App. Bezahlkurse → 402 payment_required
 * (Kauf läuft über In-App-Purchases bzw. das Web).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { courseId } = await params;
  const result = await enrollFree(auth.userId, courseId);
  if (!result.ok) {
    return jsonError(result.error, result.error === "not_found" ? 404 : 402);
  }
  return jsonResponse({ ok: true }, 201);
}
