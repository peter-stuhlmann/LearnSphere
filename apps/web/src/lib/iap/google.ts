import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import { getEnv } from "@/lib/env";

/**
 * Google Play Billing: purchaseToken wird serverseitig über die Play
 * Developer API geprüft (Service-Account) und acknowledged. RTDN-Pushes
 * (Refunds) kommen als Pub/Sub mit Google-OIDC-Token.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

interface GoogleConfig {
  packageName: string;
  email: string;
  privateKey: string;
}

function googleConfig(): GoogleConfig | null {
  const env = getEnv();
  if (
    !env.GOOGLE_PLAY_PACKAGE_NAME ||
    !env.GOOGLE_PLAY_SA_EMAIL ||
    !env.GOOGLE_PLAY_SA_PRIVATE_KEY
  ) {
    return null;
  }
  return {
    packageName: env.GOOGLE_PLAY_PACKAGE_NAME,
    email: env.GOOGLE_PLAY_SA_EMAIL,
    // \n-Escapes aus Env-Variablen zurückwandeln
    privateKey: env.GOOGLE_PLAY_SA_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
}

async function accessToken(config: GoogleConfig): Promise<string | null> {
  try {
    const key = await importPKCS8(config.privateKey, "RS256");
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(config.email)
      .setAudience(TOKEN_URL)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (error) {
    console.error("[iap/google] Token-Beschaffung fehlgeschlagen:", error);
    return null;
  }
}

export type GooglePurchaseResult =
  | {
      ok: true;
      /** orderId – Idempotenz-Schlüssel */
      orderId: string;
      obfuscatedExternalAccountId: string | null;
    }
  | { ok: false; error: "not_configured" | "invalid" };

export async function verifyGooglePurchase(
  productId: string,
  purchaseToken: string
): Promise<GooglePurchaseResult> {
  const config = googleConfig();
  if (!config) return { ok: false, error: "not_configured" };
  const token = await accessToken(config);
  if (!token) return { ok: false, error: "not_configured" };

  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(base, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return { ok: false, error: "invalid" };

  const purchase = (await response.json()) as {
    purchaseState?: number;
    acknowledgementState?: number;
    orderId?: string;
    obfuscatedExternalAccountId?: string;
  };
  // 0 = purchased (1 = canceled, 2 = pending)
  if (purchase.purchaseState !== 0 || !purchase.orderId) {
    return { ok: false, error: "invalid" };
  }

  // Innerhalb von 3 Tagen bestätigen, sonst erstattet Google automatisch
  if (purchase.acknowledgementState === 0) {
    await fetch(`${base}:acknowledge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch(() => undefined);
  }

  return {
    ok: true,
    orderId: purchase.orderId,
    obfuscatedExternalAccountId: purchase.obfuscatedExternalAccountId ?? null,
  };
}

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

/** OIDC-Token eines Pub/Sub-Push-Requests (RTDN) verifizieren. */
export async function verifyRtdnPush(
  authorizationHeader: string | null
): Promise<boolean> {
  const env = getEnv();
  if (!env.GOOGLE_RTDN_AUDIENCE) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader ?? "");
  if (!match) return false;
  try {
    await jwtVerify(match[1], GOOGLE_JWKS, {
      issuer: "https://accounts.google.com",
      audience: env.GOOGLE_RTDN_AUDIENCE,
    });
    return true;
  } catch {
    return false;
  }
}

export interface RtdnNotification {
  purchaseToken: string;
  sku: string;
  /** 1 = purchased, 2 = canceled (Refund/Void) */
  notificationType: number;
}

/** Pub/Sub-Body dekodieren (base64-JSON in message.data). */
export function parseRtdnBody(body: unknown): RtdnNotification | null {
  try {
    const data = (body as { message?: { data?: string } })?.message?.data;
    if (!data) return null;
    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
    const notification = decoded?.oneTimeProductNotification;
    if (!notification?.purchaseToken || !notification?.sku) return null;
    return {
      purchaseToken: notification.purchaseToken,
      sku: notification.sku,
      notificationType: Number(notification.notificationType ?? 0),
    };
  } catch {
    return null;
  }
}
