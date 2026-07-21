import type { NextRequest } from "next/server";
import { appleVerifyRequestSchema } from "@elearning/api-contracts/mobile/v1/iap";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { verifyAppleTransaction } from "@/lib/iap/apple";
import { fulfillVerifiedPurchase } from "@/lib/services/iap-service";

/** StoreKit-2-Kauf verifizieren (JWS bis zur Apple Root CA) + einlösen. */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  // Geld-Route: Session zusätzlich in der DB prüfen (strict)
  const session = await db.mobileSession.findUnique({
    where: { id: auth.sessionId },
    select: { revokedAt: true },
  });
  if (!session || session.revokedAt) return jsonError("unauthorized", 401);

  const body = await parseJsonBody(request, appleVerifyRequestSchema);
  if (!body.ok) return body.response;

  const verified = await verifyAppleTransaction(body.data.signedTransaction);
  if (!verified.ok) {
    return jsonResponse({ error: { code: verified.error } }, 400);
  }

  const result = await fulfillVerifiedPurchase({
    userId: auth.userId,
    intentId: body.data.intentId,
    store: "APPLE",
    storeTransactionId: `apple:${verified.transactionId}`,
    accountToken: verified.appAccountToken,
    productId: verified.productId,
    currency: verified.currency,
  });
  if (!result.ok) {
    return jsonResponse({ error: { code: result.error } }, 409);
  }
  return jsonResponse({ ok: true, courseId: result.courseId });
}
