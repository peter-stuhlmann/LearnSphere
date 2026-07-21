import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  parseRtdnBody,
  verifyGooglePurchase,
  verifyRtdnPush,
} from "@/lib/iap/google";
import { handleStoreRefund } from "@/lib/services/iap-service";

/** Play RTDN: 2 = ONE_TIME_PRODUCT_CANCELED (Refund/Void). */
const CANCELED = 2;

/**
 * Google Play Real-Time Developer Notifications (Pub/Sub-Push).
 * Auth = Google-OIDC-Token (Audience aus GOOGLE_RTDN_AUDIENCE).
 * 2xx quittiert die Nachricht; bei Fehlern retryt Pub/Sub.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!(await verifyRtdnPush(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const notification = parseRtdnBody(body);
  // Unbekannte Formate (z. B. Abo-Events) bewusst quittieren
  if (!notification) return NextResponse.json({ ok: true });

  if (notification.notificationType === CANCELED) {
    // orderId zur Transaktion über die Play API auflösen (Token → Kauf)
    const purchase = await verifyGooglePurchase(
      notification.sku,
      notification.purchaseToken
    ).catch(() => null);
    if (purchase && !purchase.ok) {
      /* Kauf nicht mehr abrufbar – nichts zu widerrufen */
    } else if (purchase?.ok) {
      await handleStoreRefund(`google:${purchase.orderId}`);
    }
  }

  return NextResponse.json({ ok: true });
}
