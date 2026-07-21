import { describe, expect, it } from "vitest";
import { generateSync } from "otplib";
import {
  buildOtpAuthUrl,
  currentTotpStep,
  generateTotpSecret,
  verifyTotp,
} from "./totp";

describe("generateTotpSecret", () => {
  it("returns a base32 secret", () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]+=*$/);
  });

  it("returns a fresh secret every time", () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe("verifyTotp", () => {
  it("accepts a currently valid token", () => {
    const secret = generateTotpSecret();
    const token = generateSync({ secret });
    expect(verifyTotp(token, secret)).toBe(true);
  });

  it("rejects a wrong token", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp("000000", secret) && verifyTotp("123456", secret)).toBe(
      false
    );
  });

  it("rejects malformed tokens without throwing", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp("nope", secret)).toBe(false);
  });
});

describe("currentTotpStep", () => {
  it("zählt in 30-Sekunden-Schritten", () => {
    expect(currentTotpStep(new Date(0))).toBe(0);
    expect(currentTotpStep(new Date(30_000))).toBe(1);
    expect(currentTotpStep(new Date(59_999))).toBe(1);
    expect(currentTotpStep(new Date(60_000))).toBe(2);
  });

  it("nutzt die aktuelle Zeit als Default", () => {
    const step = currentTotpStep();
    expect(step).toBe(Math.floor(Date.now() / 1000 / 30));
  });
});

describe("buildOtpAuthUrl", () => {
  it("embeds issuer and account into the otpauth url", () => {
    const url = buildOtpAuthUrl("user@example.com", "JBSWY3DPEHPK3PXP");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain("LearnSphere");
    expect(url).toContain(encodeURIComponent("user@example.com"));
    expect(url).toContain("JBSWY3DPEHPK3PXP");
  });
});
