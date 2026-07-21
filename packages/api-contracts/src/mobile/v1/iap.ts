import { z } from "zod";

/* Contracts der In-App-Kauf-Endpoints (Preis-Tier-Modell). */

export const iapIntentRequestSchema = z.object({
  courseId: z.string().min(1),
});
export type IapIntentRequest = z.infer<typeof iapIntentRequestSchema>;

export const iapIntentResponseSchema = z.object({
  intentId: z.string(),
  /** appAccountToken (Apple) / obfuscatedExternalAccountId (Google) */
  appAccountToken: z.string(),
  productId: z.string(),
  tierCents: z.number(),
});
export type IapIntentResponse = z.infer<typeof iapIntentResponseSchema>;

export const appleVerifyRequestSchema = z.object({
  intentId: z.string().min(1),
  /** StoreKit 2: signedTransaction (JWS) */
  signedTransaction: z.string().min(20),
});
export type AppleVerifyRequest = z.infer<typeof appleVerifyRequestSchema>;

export const googleVerifyRequestSchema = z.object({
  intentId: z.string().min(1),
  purchaseToken: z.string().min(10),
  productId: z.string().min(1),
});
export type GoogleVerifyRequest = z.infer<typeof googleVerifyRequestSchema>;

export const iapVerifyResponseSchema = z.object({
  ok: z.literal(true),
  courseId: z.string(),
});
export type IapVerifyResponse = z.infer<typeof iapVerifyResponseSchema>;
