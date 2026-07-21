import type { NextRequest } from "next/server";
import { iapIntentRequestSchema } from "@elearning/api-contracts/mobile/v1/iap";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { createPurchaseIntent } from "@/lib/services/iap-service";

/** Kaufabsicht anlegen: bindet den Store-Kauf an Kurs + Käufer. */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  if (
    !(await checkRateLimit(`mobile-iap:${auth.userId}`, {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    }))
  ) {
    return jsonError("rate_limited", 429);
  }

  const body = await parseJsonBody(request, iapIntentRequestSchema);
  if (!body.ok) return body.response;

  const result = await createPurchaseIntent(auth.userId, body.data.courseId);
  if (!result.ok) {
    switch (result.error) {
      case "not_found":
        return jsonError("not_found", 404);
      case "already_enrolled":
        return jsonResponse({ error: { code: "already_enrolled" } }, 409);
      default:
        // Gratis oder über der höchsten Preisstufe → kein IAP möglich
        return jsonResponse({ error: { code: "not_available" } }, 409);
    }
  }
  return jsonResponse({
    intentId: result.intentId,
    appAccountToken: result.appAccountToken,
    productId: result.productId,
    tierCents: result.tierCents,
  });
}
