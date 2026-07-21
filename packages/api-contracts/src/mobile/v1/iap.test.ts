import { describe, expect, it } from "vitest";
import {
  appleVerifyRequestSchema,
  googleVerifyRequestSchema,
  iapIntentRequestSchema,
  iapIntentResponseSchema,
  iapVerifyResponseSchema,
} from "./iap";

describe("iap contracts", () => {
  it("validiert Intent-Request/-Response", () => {
    expect(iapIntentRequestSchema.safeParse({ courseId: "c1" }).success).toBe(
      true
    );
    expect(iapIntentRequestSchema.safeParse({ courseId: "" }).success).toBe(
      false
    );
    expect(
      iapIntentResponseSchema.safeParse({
        intentId: "i1",
        appAccountToken: "550e8400-e29b-41d4-a716-446655440000",
        productId: "course_tier_00999",
        tierCents: 999,
      }).success
    ).toBe(true);
  });

  it("validiert Apple-/Google-Verify-Requests", () => {
    expect(
      appleVerifyRequestSchema.safeParse({
        intentId: "i1",
        signedTransaction: "x".repeat(40),
      }).success
    ).toBe(true);
    expect(
      appleVerifyRequestSchema.safeParse({
        intentId: "i1",
        signedTransaction: "kurz",
      }).success
    ).toBe(false);
    expect(
      googleVerifyRequestSchema.safeParse({
        intentId: "i1",
        purchaseToken: "t".repeat(20),
        productId: "course_tier_00999",
      }).success
    ).toBe(true);
  });

  it("verlangt ok:true in der Verify-Antwort", () => {
    expect(
      iapVerifyResponseSchema.safeParse({ ok: true, courseId: "c1" }).success
    ).toBe(true);
    expect(
      iapVerifyResponseSchema.safeParse({ ok: false, courseId: "c1" }).success
    ).toBe(false);
  });
});
