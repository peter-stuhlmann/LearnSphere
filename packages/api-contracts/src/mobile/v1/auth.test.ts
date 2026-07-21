import { describe, expect, it } from "vitest";
import {
  loginRequestSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  loginResponseSchema,
  okResponseSchema,
} from "./auth";
import { errorEnvelope, errorEnvelopeSchema } from "./error";

describe("loginRequestSchema", () => {
  it("akzeptiert Login mit optionalem TOTP und Gerät", () => {
    const parsed = loginRequestSchema.parse({
      email: "USER@Example.com",
      password: "geheim123",
      totp: "123456",
      device: { platform: "ios", name: "iPhone 15", appVersion: "1.0.0" },
    });
    expect(parsed.email).toBe("user@example.com");
    expect(parsed.device?.platform).toBe("ios");
  });

  it("lehnt fehlendes Passwort ab", () => {
    expect(
      loginRequestSchema.safeParse({ email: "a@b.de", password: "" }).success
    ).toBe(false);
  });
});

describe("registerRequestSchema", () => {
  const base = {
    name: "Ada Lovelace",
    email: "Ada@Example.com",
    password: "passwort1",
    confirmPassword: "passwort1",
    acceptTerms: true,
  };

  it("übernimmt die Web-Registrierungsregeln (Passwort-Match, E-Mail-Lowercase)", () => {
    const parsed = registerRequestSchema.parse(base);
    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.locale).toBe("de");
  });

  it("lehnt abweichende Passwörter ab", () => {
    expect(
      registerRequestSchema.safeParse({
        ...base,
        confirmPassword: "anders123",
      }).success
    ).toBe(false);
  });
});

describe("refresh/reset schemas", () => {
  it("verlangt einen ausreichend langen Refresh-Token", () => {
    expect(refreshRequestSchema.safeParse({ refreshToken: "kurz" }).success).toBe(
      false
    );
    expect(
      refreshRequestSchema.safeParse({ refreshToken: "a".repeat(64) }).success
    ).toBe(true);
  });

  it("normalisiert die Reset-E-Mail", () => {
    expect(
      passwordResetRequestSchema.parse({ email: "X@Y.de" }).email
    ).toBe("x@y.de");
    expect(
      passwordResetConfirmSchema.safeParse({ token: "t".repeat(32), password: "neu" })
        .success
    ).toBe(true);
  });
});

describe("responses & errors", () => {
  it("validiert die Login-Antwort", () => {
    expect(
      loginResponseSchema.safeParse({
        accessToken: "jwt",
        accessTokenExpiresAt: 1750000000000,
        refreshToken: "r".repeat(64),
        user: {
          id: "u1",
          email: "a@b.de",
          name: null,
          role: "CLIENT",
          locale: "de",
          totpEnabled: false,
        },
      }).success
    ).toBe(true);
    expect(okResponseSchema.safeParse({ ok: true }).success).toBe(true);
  });

  it("baut und validiert Fehler-Envelopes", () => {
    expect(errorEnvelope("unauthorized")).toEqual({
      error: { code: "unauthorized" },
    });
    expect(errorEnvelope("validation_failed", ["email"])).toEqual({
      error: { code: "validation_failed", details: ["email"] },
    });
    expect(
      errorEnvelopeSchema.safeParse(errorEnvelope("2fa_required")).success
    ).toBe(true);
    expect(
      errorEnvelopeSchema.safeParse({ error: { code: "nope" } }).success
    ).toBe(false);
  });
});
