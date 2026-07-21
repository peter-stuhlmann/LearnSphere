import { describe, expect, it } from "vitest";
import {
  IAP_MAX_TIER_CENTS,
  IAP_TIER_CENTS,
  priceCentsToTier,
  tierCentsForProductId,
  tierProductId,
} from "./iap-tiers";

describe("priceCentsToTier", () => {
  it("mappt auf die kleinste Stufe ≥ Preis (Creator bekommt nie weniger)", () => {
    expect(priceCentsToTier(499)).toEqual({
      productId: "course_tier_00499",
      tierCents: 499,
    });
    expect(priceCentsToTier(500)).toEqual({
      productId: "course_tier_00999",
      tierCents: 999,
    });
    expect(priceCentsToTier(10000)).toEqual({
      productId: "course_tier_12499",
      tierCents: 12499,
    });
  });

  it("liefert null für Gratiskurse und Preise über der höchsten Stufe", () => {
    expect(priceCentsToTier(0)).toBeNull();
    expect(priceCentsToTier(-1)).toBeNull();
    expect(priceCentsToTier(IAP_MAX_TIER_CENTS + 1)).toBeNull();
  });

  it("jede Stufe mappt auf sich selbst", () => {
    for (const tier of IAP_TIER_CENTS) {
      expect(priceCentsToTier(tier)?.tierCents).toBe(tier);
    }
  });
});

describe("tierProductId/tierCentsForProductId", () => {
  it("roundtrip über alle Stufen", () => {
    for (const tier of IAP_TIER_CENTS) {
      expect(tierCentsForProductId(tierProductId(tier))).toBe(tier);
    }
  });

  it("lehnt fremde Produkt-IDs ab", () => {
    expect(tierCentsForProductId("course_tier_00777")).toBeNull();
    expect(tierCentsForProductId("premium_abo")).toBeNull();
    expect(tierCentsForProductId("course_tier_499")).toBeNull();
  });
});
