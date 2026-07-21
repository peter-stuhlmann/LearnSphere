import { describe, expect, it } from "vitest";
import {
  REFUND_GUARANTEE_DAYS,
  isGuaranteeActive,
  normalizeRefundReason,
  refundDeadline,
} from "./refund";

const NOW = new Date("2026-08-01T12:00:00.000Z");

describe("refundDeadline", () => {
  it("liegt 30 Tage nach dem Kauf", () => {
    expect(REFUND_GUARANTEE_DAYS).toBe(30);
    expect(refundDeadline(new Date("2026-08-01T12:00:00Z")).toISOString()).toBe(
      "2026-08-31T12:00:00.000Z"
    );
  });
});

describe("isGuaranteeActive", () => {
  it("aktiv innerhalb des Fensters", () => {
    expect(
      isGuaranteeActive(
        {
          refundableUntil: new Date("2026-08-15T00:00:00Z"),
          guaranteeWaivedAt: null,
        },
        NOW
      )
    ).toBe(true);
  });

  it("inaktiv nach Ablauf, Verzicht oder ohne Rückgaberecht", () => {
    expect(
      isGuaranteeActive(
        {
          refundableUntil: new Date("2026-07-15T00:00:00Z"),
          guaranteeWaivedAt: null,
        },
        NOW
      )
    ).toBe(false);
    expect(
      isGuaranteeActive(
        {
          refundableUntil: new Date("2026-08-15T00:00:00Z"),
          guaranteeWaivedAt: new Date("2026-08-01T00:00:00Z"),
        },
        NOW
      )
    ).toBe(false);
    expect(
      isGuaranteeActive({ refundableUntil: null, guaranteeWaivedAt: null }, NOW)
    ).toBe(false);
  });

  it("exakt zum Fristende ist die Garantie vorbei", () => {
    expect(
      isGuaranteeActive(
        { refundableUntil: NOW, guaranteeWaivedAt: null },
        NOW
      )
    ).toBe(false);
  });
});

describe("normalizeRefundReason", () => {
  it("trimmt, begrenzt und leert sauber", () => {
    expect(normalizeRefundReason("  passt nicht  ")).toBe("passt nicht");
    expect(normalizeRefundReason("   ")).toBeNull();
    expect(normalizeRefundReason(undefined)).toBeNull();
    expect(normalizeRefundReason(42)).toBeNull();
    expect(normalizeRefundReason("x".repeat(3000))).toHaveLength(2000);
  });
});
