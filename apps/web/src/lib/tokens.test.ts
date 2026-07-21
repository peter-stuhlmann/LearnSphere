import { describe, expect, it } from "vitest";
import { generateToken, hashToken, isExpired } from "./tokens";

describe("generateToken", () => {
  it("returns a 64 character hex string", () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a different token every time", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe("hashToken", () => {
  it("hashes deterministically with sha256", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("different inputs produce different hashes", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

describe("isExpired", () => {
  it("is expired when the date is in the past", () => {
    expect(isExpired(new Date("2026-01-01"), new Date("2026-01-02"))).toBe(
      true
    );
  });

  it("is not expired when the date is in the future", () => {
    expect(isExpired(new Date("2026-01-02"), new Date("2026-01-01"))).toBe(
      false
    );
  });

  it("is expired at the exact moment", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    expect(isExpired(now, now)).toBe(true);
  });
});
