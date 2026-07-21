import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";
import { getEnv } from "@/lib/env";

/**
 * Apple StoreKit 2: signedTransaction/Notifications sind JWS, deren
 * Zertifikatskette bis zur Apple Root CA geprüft werden muss. Die Root-
 * Zertifikate (apple.com/certificateauthority) liegen als Dateien in
 * APPLE_ROOT_CA_DIR. Ohne Konfiguration ist Apple-IAP deaktiviert.
 */

let verifierPromise: Promise<SignedDataVerifier | null> | null = null;

async function buildVerifier(): Promise<SignedDataVerifier | null> {
  const env = getEnv();
  if (!env.APPLE_IAP_BUNDLE_ID || !env.APPLE_ROOT_CA_DIR) return null;
  try {
    const dir = env.APPLE_ROOT_CA_DIR;
    const files = (await readdir(dir)).filter((f) =>
      /\.(cer|pem|der)$/i.test(f)
    );
    if (files.length === 0) return null;
    const certs = await Promise.all(
      files.map((f) => readFile(path.join(dir, f)))
    );
    return new SignedDataVerifier(
      certs,
      true, // Online-Revocation-Checks (OCSP)
      env.APPLE_IAP_ENVIRONMENT === "Production"
        ? Environment.PRODUCTION
        : Environment.SANDBOX,
      env.APPLE_IAP_BUNDLE_ID
    );
  } catch (error) {
    console.error("[iap/apple] Verifier-Setup fehlgeschlagen:", error);
    return null;
  }
}

function getVerifier(): Promise<SignedDataVerifier | null> {
  verifierPromise ??= buildVerifier();
  return verifierPromise;
}

export type AppleTransactionResult =
  | {
      ok: true;
      /** originalTransactionId – Idempotenz-Schlüssel */
      transactionId: string;
      productId: string;
      appAccountToken: string | null;
      currency: string | null;
    }
  | { ok: false; error: "not_configured" | "invalid" };

export async function verifyAppleTransaction(
  signedTransaction: string
): Promise<AppleTransactionResult> {
  const verifier = await getVerifier();
  if (!verifier) return { ok: false, error: "not_configured" };
  try {
    const payload = await verifier.verifyAndDecodeTransaction(
      signedTransaction
    );
    if (!payload.originalTransactionId || !payload.productId) {
      return { ok: false, error: "invalid" };
    }
    return {
      ok: true,
      transactionId: payload.originalTransactionId,
      productId: payload.productId,
      appAccountToken: payload.appAccountToken ?? null,
      currency: payload.currency ?? null,
    };
  } catch {
    return { ok: false, error: "invalid" };
  }
}

export type AppleNotificationResult =
  | {
      ok: true;
      notificationType: string;
      transactionId: string | null;
    }
  | { ok: false; error: "not_configured" | "invalid" };

/** App Store Server Notification V2 (Refund/Revoke) verifizieren. */
export async function verifyAppleNotification(
  signedPayload: string
): Promise<AppleNotificationResult> {
  const verifier = await getVerifier();
  if (!verifier) return { ok: false, error: "not_configured" };
  try {
    const decoded = await verifier.verifyAndDecodeNotification(signedPayload);
    let transactionId: string | null = null;
    if (decoded.data?.signedTransactionInfo) {
      const tx = await verifier.verifyAndDecodeTransaction(
        decoded.data.signedTransactionInfo
      );
      transactionId = tx.originalTransactionId ?? null;
    }
    return {
      ok: true,
      notificationType: decoded.notificationType ?? "UNKNOWN",
      transactionId,
    };
  } catch {
    return { ok: false, error: "invalid" };
  }
}
