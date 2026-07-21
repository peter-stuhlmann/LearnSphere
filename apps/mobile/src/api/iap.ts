import { Platform } from "react-native";
import type { Purchase } from "expo-iap";
import { iapIntentResponseSchema } from "@elearning/api-contracts/mobile/v1/iap";
import { apiRequest } from "./client";

/* expo-iap ist ein natives Modul und existiert in Expo Go nicht –
   deshalb Lazy-Import: In Expo Go liefert buyCourse einen sauberen
   Fehler (iap_unavailable) statt beim App-Start zu crashen. */
type IapModule = typeof import("expo-iap");

async function loadIap(): Promise<IapModule | null> {
  try {
    return await import("expo-iap");
  } catch {
    return null;
  }
}

/**
 * Kurskauf über native In-App-Purchases (Preis-Tier-Modell):
 * 1. Intent am Server anlegen (bindet Kauf an Kurs + Konto)
 * 2. Store-Kauf des Tier-Produkts (appAccountToken = Intent-Bindung)
 * 3. Beleg serverseitig verifizieren → Einschreibung
 * 4. finishTransaction
 *
 * WICHTIG: Der komplette Fluss ist nur auf echten Geräten mit
 * Sandbox-/Internal-Testing-Konten testbar.
 */

export type PurchaseResult =
  | { status: "ok"; courseId: string }
  | { status: "error"; code: string };

export async function buyCourse(courseId: string): Promise<PurchaseResult> {
  // Natives Store-Modul verfügbar? (Expo Go: nein → Dev-Build nötig)
  const iap = await loadIap();
  if (!iap) return { status: "error", code: "iap_unavailable" };

  // 1. Kaufabsicht am Server
  const rawIntent = await apiRequest<unknown>("/api/mobile/v1/iap/intent", {
    method: "POST",
    body: { courseId },
  });
  const intent = iapIntentResponseSchema.parse(rawIntent);

  await iap.initConnection();
  try {
    // 2. Produkt laden (lokalisierter Store-Preis) und Kauf starten
    await iap.fetchProducts({ skus: [intent.productId], type: "in-app" });

    const purchase = await purchaseOnce(
      iap,
      intent.productId,
      intent.appAccountToken
    );

    // 3. Serverseitige Verifikation → Einschreibung
    const verified = await verifyWithServer(intent.intentId, purchase);

    // 4. Kauf im Store abschließen (consumable-Verhalten: nicht nötig,
    // Kurszugriff lebt in unserer DB – Produkt bleibt non-consumable)
    await iap
      .finishTransaction({ purchase, isConsumable: false })
      .catch(() => undefined);

    return verified;
  } finally {
    await iap.endConnection().catch(() => undefined);
  }
}

/** Kauf starten und auf genau ein Update (Erfolg/Fehler) warten. */
function purchaseOnce(
  iap: IapModule,
  productId: string,
  appAccountToken: string
): Promise<Purchase> {
  return new Promise<Purchase>((resolve, reject) => {
    const updateSub = iap.purchaseUpdatedListener((purchase) => {
      cleanup();
      resolve(purchase);
    });
    const errorSub = iap.purchaseErrorListener((error) => {
      cleanup();
      reject(new Error(error.code ?? "purchase_failed"));
    });
    function cleanup() {
      updateSub.remove();
      errorSub.remove();
    }

    iap
      .requestPurchase({
        request: {
          ios: {
            sku: productId,
            appAccountToken,
          },
          android: {
            skus: [productId],
            obfuscatedAccountId: appAccountToken,
          },
        },
        type: "in-app",
      })
      .catch((error: unknown) => {
        cleanup();
        reject(error instanceof Error ? error : new Error("purchase_failed"));
      });
  });
}

async function verifyWithServer(
  intentId: string,
  purchase: Purchase
): Promise<PurchaseResult> {
  try {
    if (Platform.OS === "ios") {
      // StoreKit 2: JWS-Beleg (Feldname je expo-iap-Version)
      const jws =
        (purchase as { jwsRepresentationIos?: string }).jwsRepresentationIos ??
        (purchase as { transactionReceipt?: string }).transactionReceipt;
      if (!jws) return { status: "error", code: "missing_receipt" };
      const result = await apiRequest<{ ok: true; courseId: string }>(
        "/api/mobile/v1/iap/apple/verify",
        { method: "POST", body: { intentId, signedTransaction: jws } }
      );
      return { status: "ok", courseId: result.courseId };
    }

    const token = (purchase as { purchaseToken?: string }).purchaseToken;
    if (!token) return { status: "error", code: "missing_receipt" };
    const result = await apiRequest<{ ok: true; courseId: string }>(
      "/api/mobile/v1/iap/google/verify",
      {
        method: "POST",
        body: {
          intentId,
          purchaseToken: token,
          productId: purchase.productId,
        },
      }
    );
    return { status: "ok", courseId: result.courseId };
  } catch (error) {
    return {
      status: "error",
      code: error instanceof Error ? error.message : "verify_failed",
    };
  }
}
