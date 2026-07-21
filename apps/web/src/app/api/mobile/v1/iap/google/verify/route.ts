import type { NextRequest } from "next/server";
import { googleVerifyRequestSchema } from "@elearning/api-contracts/mobile/v1/iap";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { verifyGooglePurchase } from "@/lib/iap/google";
import { fulfillVerifiedPurchase } from "@/lib/services/iap-service";

/** Play-Billing-Kauf serverseitig prüfen (+acknowledge) und einlösen. */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  // Geld-Route: Session zusätzlich in der DB prüfen (strict)
  const session = await db.mobileSession.findUnique({
    where: { id: auth.sessionId },
    select: { revokedAt: true },
  });
  if (!session || session.revokedAt) return jsonError("unauthorized", 401);

  const body = await parseJsonBody(request, googleVerifyRequestSchema);
  if (!body.ok) return body.response;

  const verified = await verifyGooglePurchase(
    body.data.productId,
    body.data.purchaseToken
  );
  if (!verified.ok) {
    return jsonResponse({ error: { code: verified.error } }, 400);
  }

  const result = await fulfillVerifiedPurchase({
    userId: auth.userId,
    intentId: body.data.intentId,
    store: "GOOGLE",
    storeTransactionId: `google:${verified.orderId}`,
    accountToken: verified.obfuscatedExternalAccountId,
    productId: body.data.productId,
  });
  if (!result.ok) {
    return jsonResponse({ error: { code: result.error } }, 409);
  }
  return jsonResponse({ ok: true, courseId: result.courseId });
}
