export type CouponKind = "PERCENT" | "AMOUNT_OFF" | "FIXED_PRICE";

export interface CouponRecord {
  kind: CouponKind;
  value: number;
  active: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  maxRedemptions: number | null;
  redeemedCount: number;
}

export type CouponValidation =
  | { ok: true }
  | {
      ok: false;
      error:
        | "coupon_inactive"
        | "coupon_not_started"
        | "coupon_expired"
        | "coupon_exhausted";
    };

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export function validateCoupon(
  coupon: CouponRecord,
  now: Date
): CouponValidation {
  if (!coupon.active) {
    return { ok: false, error: "coupon_inactive" };
  }
  if (coupon.validFrom && now < coupon.validFrom) {
    return { ok: false, error: "coupon_not_started" };
  }
  if (coupon.validUntil && now > coupon.validUntil) {
    return { ok: false, error: "coupon_expired" };
  }
  if (
    coupon.maxRedemptions !== null &&
    coupon.redeemedCount >= coupon.maxRedemptions
  ) {
    return { ok: false, error: "coupon_exhausted" };
  }
  return { ok: true };
}

/** Berechnet den Endpreis in Cent. Nie negativ, nie teurer als vorher. */
export function applyCoupon(
  priceCents: number,
  coupon: { kind: CouponKind; value: number }
): number {
  switch (coupon.kind) {
    case "PERCENT":
      return Math.round((priceCents * (100 - coupon.value)) / 100);
    case "AMOUNT_OFF":
      return Math.max(0, priceCents - coupon.value);
    case "FIXED_PRICE":
      return Math.min(priceCents, Math.max(0, coupon.value));
  }
}
