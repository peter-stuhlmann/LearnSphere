import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyAppleNotification } from "@/lib/iap/apple";
import { handleStoreRefund } from "@/lib/services/iap-service";

/** Refund/Revoke führt zum Entzug der Einschreibung. */
const REVOKING_TYPES = new Set(["REFUND", "REVOKE"]);

/**
 * App Store Server Notifications V2. Auth = JWS-Signatur im Payload
 * (verifiziert bis zur Apple Root CA); immer 200 für bekannte Formate,
 * sonst retryt Apple endlos.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let signedPayload: string | undefined;
  try {
    signedPayload = ((await request.json()) as { signedPayload?: string })
      .signedPayload;
  } catch {
    /* kein JSON */
  }
  if (!signedPayload) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const notification = await verifyAppleNotification(signedPayload);
  if (!notification.ok) {
    return NextResponse.json(
      { error: notification.error },
      { status: notification.error === "not_configured" ? 503 : 401 }
    );
  }

  if (
    REVOKING_TYPES.has(notification.notificationType) &&
    notification.transactionId
  ) {
    await handleStoreRefund(`apple:${notification.transactionId}`);
  }

  return NextResponse.json({ ok: true });
}
