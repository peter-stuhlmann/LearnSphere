import { describe, expect, it } from "vitest";
import {
  BUSINESS_MIN_SEAT_CENTS,
  BUSINESS_MIN_SEATS,
  BUSINESS_VOLUME_DISCOUNTS,
  businessOrderTotalCents,
  businessRevenueSplitCents,
  businessSeatPriceCents,
  businessVolumeDiscountRate,
  validateSeatCount,
} from "./business";

describe("Business-Preis-Konstanten", () => {
  it("hat Mengenrabatt-Staffeln und eine Untergrenze", () => {
    expect(BUSINESS_VOLUME_DISCOUNTS).toEqual([
      { minSeats: 25, rate: 0.3 },
      { minSeats: 10, rate: 0.2 },
      { minSeats: 3, rate: 0.1 },
    ]);
    expect(BUSINESS_MIN_SEAT_CENTS).toBe(400);
  });
});

describe("validateSeatCount", () => {
  it("verlangt mindestens 1 Seat", () => {
    expect(BUSINESS_MIN_SEATS).toBe(1);
    expect(validateSeatCount(0)).toBe(false);
    expect(validateSeatCount(1)).toBe(true);
    expect(validateSeatCount(250)).toBe(true);
  });

  it("lehnt Unsinn ab (keine Ganzzahl, zu groß)", () => {
    expect(validateSeatCount(1.5)).toBe(false);
    expect(validateSeatCount(Number.NaN)).toBe(false);
    expect(validateSeatCount(10_001)).toBe(false);
  });
});

describe("businessVolumeDiscountRate", () => {
  it("gibt unterhalb der ersten Staffel keinen Rabatt", () => {
    expect(businessVolumeDiscountRate(1)).toBe(0);
    expect(businessVolumeDiscountRate(2)).toBe(0);
  });

  it("staffelt den Rabatt nach Seat-Anzahl", () => {
    expect(businessVolumeDiscountRate(3)).toBe(0.1);
    expect(businessVolumeDiscountRate(9)).toBe(0.1);
    expect(businessVolumeDiscountRate(10)).toBe(0.2);
    expect(businessVolumeDiscountRate(24)).toBe(0.2);
    expect(businessVolumeDiscountRate(25)).toBe(0.3);
    expect(businessVolumeDiscountRate(1000)).toBe(0.3);
  });
});

describe("businessSeatPriceCents", () => {
  it("zieht den Mengenrabatt vom Kurspreis ab", () => {
    // 100-€-Kurs: 3–9 → 90 €, 10–24 → 80 €, 25+ → 70 €
    expect(businessSeatPriceCents(10000, 3)).toBe(9000);
    expect(businessSeatPriceCents(10000, 10)).toBe(8000);
    expect(businessSeatPriceCents(10000, 25)).toBe(7000);
  });

  it("rundet kaufmännisch auf ganze Cent", () => {
    // 4999 × 0,9 = 4499,1 → 4499
    expect(businessSeatPriceCents(4999, 3)).toBe(4499);
  });

  it("greift bei günstigen/kostenlosen Kursen auf die Untergrenze zurück", () => {
    // 4-€-Kurs − 10 % = 3,60 € < 4 € Floor
    expect(businessSeatPriceCents(400, 3)).toBe(BUSINESS_MIN_SEAT_CENTS);
    expect(businessSeatPriceCents(0, 3)).toBe(BUSINESS_MIN_SEAT_CENTS);
  });
});

describe("businessOrderTotalCents", () => {
  it("ist Seats × rabattierter Seat-Preis", () => {
    // 100-€-Kurs, 20 Seats → 80 €/Seat → 1.600 €
    expect(businessOrderTotalCents(10000, 20)).toBe(160000);
    // 100-€-Kurs, 3 Seats → 90 €/Seat → 270 €
    expect(businessOrderTotalCents(10000, 3)).toBe(27000);
  });
});

describe("businessRevenueSplitCents", () => {
  const month = 9000;

  it("teilt 50 % Creator / 15 % Affiliate / Rest LearnSphere", () => {
    const split = businessRevenueSplitCents({
      totalCents: month,
      creatorIsOwner: false,
      hasAffiliate: true,
    });
    expect(split).toEqual({
      learnsphereCents: 3150,
      affiliateCents: 1350,
      creatorCents: 4500,
    });
    expect(
      split.learnsphereCents + split.affiliateCents + split.creatorCents
    ).toBe(month);
  });

  it("ohne Affiliate wandert dessen Anteil zu LearnSphere (Creator behält 50 %)", () => {
    const split = businessRevenueSplitCents({
      totalCents: month,
      creatorIsOwner: false,
      hasAffiliate: false,
    });
    expect(split).toEqual({
      learnsphereCents: 4500,
      affiliateCents: 0,
      creatorCents: 4500,
    });
  });

  it("ist der Inhaber selbst der Creator, geht dessen Anteil an LearnSphere", () => {
    const split = businessRevenueSplitCents({
      totalCents: month,
      creatorIsOwner: true,
      hasAffiliate: true,
    });
    expect(split).toEqual({
      learnsphereCents: 7650,
      affiliateCents: 1350,
      creatorCents: 0,
    });
  });

  it("ohne Affiliate und mit Inhaber = Creator gehen 100 % an LearnSphere", () => {
    const split = businessRevenueSplitCents({
      totalCents: month,
      creatorIsOwner: true,
      hasAffiliate: false,
    });
    expect(split).toEqual({
      learnsphereCents: 9000,
      affiliateCents: 0,
      creatorCents: 0,
    });
  });

  it("bleibt bei krummen Beträgen summentreu (Rest an LearnSphere)", () => {
    const split = businessRevenueSplitCents({
      totalCents: 1001,
      creatorIsOwner: false,
      hasAffiliate: true,
    });
    expect(
      split.learnsphereCents + split.affiliateCents + split.creatorCents
    ).toBe(1001);
    expect(split.affiliateCents).toBe(Math.floor(1001 * 0.15));
    expect(split.creatorCents).toBe(Math.floor(1001 * 0.5));
  });
});
