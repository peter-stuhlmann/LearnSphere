import { describe, expect, it } from "vitest";
import {
  creatorShareCents,
  CREATOR_SHARE_PERCENT,
  platformFeeCents,
  storeFeeCents,
  iapCreatorShareCents,
} from "./revenue";

describe("creatorShareCents", () => {
  it("gives the creator 50 percent for platform sales", () => {
    expect(creatorShareCents(1000, "PLATFORM")).toBe(500);
    expect(CREATOR_SHARE_PERCENT.PLATFORM).toBe(50);
  });

  it("gives the creator 75 percent for external sales (API/widget)", () => {
    expect(creatorShareCents(1000, "EXTERNAL")).toBe(750);
    expect(CREATOR_SHARE_PERCENT.EXTERNAL).toBe(75);
  });

  it("rounds to whole cents", () => {
    // 50 % von 1999 = 999,5 → 1000
    expect(creatorShareCents(1999, "PLATFORM")).toBe(1000);
    // 75 % von 1999 = 1499,25 → 1499
    expect(creatorShareCents(1999, "EXTERNAL")).toBe(1499);
  });

  it("returns 0 for free courses", () => {
    expect(creatorShareCents(0, "PLATFORM")).toBe(0);
  });

  it("falls back to the platform share for unknown channels", () => {
    expect(creatorShareCents(1000, "UNBEKANNT")).toBe(500);
  });
});

describe("platformFeeCents", () => {
  it("is the remainder of the creator share", () => {
    expect(platformFeeCents(1000, "PLATFORM")).toBe(500);
    expect(platformFeeCents(1000, "EXTERNAL")).toBe(250);
  });

  it("share and fee always add up to the total", () => {
    for (const amount of [1, 999, 1999, 4999, 12345]) {
      for (const channel of ["PLATFORM", "EXTERNAL"]) {
        expect(
          creatorShareCents(amount, channel) + platformFeeCents(amount, channel)
        ).toBe(amount);
      }
    }
  });
});

describe("IAP: storeFeeCents/iapCreatorShareCents", () => {
  it("berechnet die Store-Provision auf dem Brutto", () => {
    expect(storeFeeCents(1999, 15)).toBe(300);
    expect(storeFeeCents(1999, 30)).toBe(600);
    expect(storeFeeCents(0, 15)).toBe(0);
  });

  it("Creator-Anteil = 50 % vom Netto nach Store-Gebühr", () => {
    // 1999 - 15 % (300) = 1699 → 50 % = 850 (gerundet)
    expect(iapCreatorShareCents(1999, 15)).toBe(850);
    // 1999 - 30 % (600) = 1399 → 50 % = 700 (gerundet)
    expect(iapCreatorShareCents(1999, 30)).toBe(700);
  });

  it("Netto deckt Creator-Anteil + Plattform-Rest", () => {
    for (const gross of [499, 999, 4999, 19999]) {
      const net = gross - storeFeeCents(gross, 15);
      const creator = iapCreatorShareCents(gross, 15);
      expect(creator).toBeLessThanOrEqual(net);
      expect(creator).toBeGreaterThan(0);
    }
  });
});
