import { describe, expect, it } from "vitest";
import {
  applyCoupon,
  normalizeCouponCode,
  validateCoupon,
  type CouponRecord,
} from "./coupon";

const NOW = new Date("2026-07-07T12:00:00Z");

const BASE: CouponRecord = {
  kind: "PERCENT",
  value: 50,
  active: true,
  validFrom: null,
  validUntil: null,
  maxRedemptions: null,
  redeemedCount: 0,
};

describe("normalizeCouponCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeCouponCode("  sommer25 ")).toBe("SOMMER25");
  });
});

describe("validateCoupon", () => {
  it("accepts a plain active coupon", () => {
    expect(validateCoupon(BASE, NOW)).toEqual({ ok: true });
  });

  it("rejects inactive coupons", () => {
    expect(validateCoupon({ ...BASE, active: false }, NOW)).toEqual({
      ok: false,
      error: "coupon_inactive",
    });
  });

  it("rejects coupons before their start date", () => {
    expect(
      validateCoupon(
        { ...BASE, validFrom: new Date("2026-08-01") },
        NOW
      )
    ).toEqual({ ok: false, error: "coupon_not_started" });
  });

  it("rejects expired coupons", () => {
    expect(
      validateCoupon(
        { ...BASE, validUntil: new Date("2026-07-01") },
        NOW
      )
    ).toEqual({ ok: false, error: "coupon_expired" });
  });

  it("accepts a coupon inside its validity window", () => {
    expect(
      validateCoupon(
        {
          ...BASE,
          validFrom: new Date("2026-07-01"),
          validUntil: new Date("2026-08-01"),
        },
        NOW
      )
    ).toEqual({ ok: true });
  });

  it("rejects exhausted coupons", () => {
    expect(
      validateCoupon({ ...BASE, maxRedemptions: 10, redeemedCount: 10 }, NOW)
    ).toEqual({ ok: false, error: "coupon_exhausted" });
  });

  it("accepts coupons with redemptions left", () => {
    expect(
      validateCoupon({ ...BASE, maxRedemptions: 10, redeemedCount: 9 }, NOW)
    ).toEqual({ ok: true });
  });
});

describe("applyCoupon", () => {
  it("applies percent discounts", () => {
    expect(applyCoupon(1999, { kind: "PERCENT", value: 50 })).toBe(1000);
  });

  it("100 percent makes the course free", () => {
    expect(applyCoupon(1999, { kind: "PERCENT", value: 100 })).toBe(0);
  });

  it("applies fixed euro discounts", () => {
    expect(applyCoupon(1999, { kind: "AMOUNT_OFF", value: 500 })).toBe(1499);
  });

  it("euro discounts never go below zero", () => {
    expect(applyCoupon(1999, { kind: "AMOUNT_OFF", value: 5000 })).toBe(0);
  });

  it("applies fixed end prices", () => {
    expect(applyCoupon(1999, { kind: "FIXED_PRICE", value: 999 })).toBe(999);
  });

  it("a fixed end price never raises the price", () => {
    expect(applyCoupon(1999, { kind: "FIXED_PRICE", value: 4999 })).toBe(1999);
  });

  it("rounds percent results to whole cents", () => {
    expect(applyCoupon(999, { kind: "PERCENT", value: 33 })).toBe(669);
  });
});
