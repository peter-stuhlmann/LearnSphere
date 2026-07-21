import { describe, expect, it } from "vitest";
import {
  AFFILIATE_COOKIE,
  AFFILIATE_WINDOW_DAYS,
  canEarnCommission,
  isValidAffiliateCode,
} from "./affiliate";
import { AFFILIATE_SHARE_PERCENT, affiliateShareCents } from "./revenue";

describe("affiliate share", () => {
  it("is 15 percent of the paid price", () => {
    expect(AFFILIATE_SHARE_PERCENT).toBe(15);
    expect(affiliateShareCents(4900)).toBe(735);
    expect(affiliateShareCents(0)).toBe(0);
  });

  it("rounds to whole cents", () => {
    expect(affiliateShareCents(999)).toBe(150); // 149,85 → 150
  });

  it("creator 60 + affiliate 15 leave a positive platform rest", () => {
    const price = 4900;
    const creator = Math.round((price * 60) / 100);
    const rest = price - creator - affiliateShareCents(price);
    expect(rest).toBeGreaterThan(0);
  });
});

describe("isValidAffiliateCode", () => {
  it("accepts lowercase alphanumeric codes of sane length", () => {
    expect(isValidAffiliateCode("a1b2c3d4")).toBe(true);
    expect(isValidAffiliateCode("f".repeat(32))).toBe(true);
  });

  it("rejects junk", () => {
    expect(isValidAffiliateCode("")).toBe(false);
    expect(isValidAffiliateCode("short")).toBe(false);
    expect(isValidAffiliateCode("UPPER-CASE!")).toBe(false);
    expect(isValidAffiliateCode("x".repeat(64))).toBe(false);
  });
});

describe("canEarnCommission", () => {
  const base = {
    affiliateUserId: "aff",
    buyerUserId: "buyer",
    creatorUserId: "creator",
    priceCents: 4900,
  };

  it("allows a normal referred paid sale", () => {
    expect(canEarnCommission(base)).toBe(true);
  });

  it("blocks self-referral by the buyer", () => {
    expect(canEarnCommission({ ...base, buyerUserId: "aff" })).toBe(false);
  });

  it("blocks the course creator referring their own course", () => {
    expect(canEarnCommission({ ...base, creatorUserId: "aff" })).toBe(false);
  });

  it("blocks free courses", () => {
    expect(canEarnCommission({ ...base, priceCents: 0 })).toBe(false);
  });

  it("blocks when no affiliate is attributed", () => {
    expect(canEarnCommission({ ...base, affiliateUserId: null })).toBe(false);
  });
});

describe("constants", () => {
  it("cookie name and attribution window are fixed", () => {
    expect(AFFILIATE_COOKIE).toBe("ls_aff");
    expect(AFFILIATE_WINDOW_DAYS).toBe(7);
  });
});
