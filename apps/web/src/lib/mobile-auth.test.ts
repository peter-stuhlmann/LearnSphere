// @vitest-environment node
/* jose prüft Uint8Array per instanceof – die jsdom-Realm-Kopie fällt durch,
   daher läuft diese Suite in der node-Umgebung (wie zur Laufzeit). */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_TTL_S,
  authenticateMobileRequest,
  bearerToken,
  mobileJwtSecret,
  signAccessToken,
  verifyAccessToken,
} from "./mobile-auth";
import { resetEnvCache } from "./env";

const secret = new TextEncoder().encode("test-secret-mindestens-16-zeichen");
const otherSecret = new TextEncoder().encode("anderes-secret-mindestens-16");

const payload = { userId: "u1", role: "CLIENT", sessionId: "s1" };

function requestWithAuth(header: string | null) {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? header : null,
    },
  };
}

describe("sign/verifyAccessToken", () => {
  it("roundtrip: signierter Token trägt userId, Rolle und Session", async () => {
    const now = new Date();
    const { token, expiresAt } = await signAccessToken(payload, {
      secret,
      now,
    });
    expect(expiresAt).toBe(now.getTime() + ACCESS_TOKEN_TTL_S * 1000);
    await expect(verifyAccessToken(token, secret)).resolves.toEqual(payload);
  });

  it("lehnt falsches Secret, Müll und abgelaufene Tokens ab", async () => {
    const { token } = await signAccessToken(payload, { secret });
    await expect(verifyAccessToken(token, otherSecret)).resolves.toBeNull();
    await expect(verifyAccessToken("kein-jwt", secret)).resolves.toBeNull();

    const expired = await signAccessToken(payload, {
      secret,
      now: new Date(Date.now() - 2 * ACCESS_TOKEN_TTL_S * 1000),
    });
    await expect(verifyAccessToken(expired.token, secret)).resolves.toBeNull();
  });

  it("verwirft Tokens ohne Session-Claim", async () => {
    const { SignJWT } = await import("jose");
    const token = await new SignJWT({ role: "CLIENT" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuer("learnsphere-mobile")
      .setExpirationTime("15m")
      .sign(secret);
    await expect(verifyAccessToken(token, secret)).resolves.toBeNull();
  });

  it("nutzt CLIENT als Fallback-Rolle bei fehlendem role-Claim", async () => {
    const { SignJWT } = await import("jose");
    const token = await new SignJWT({ sid: "s1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuer("learnsphere-mobile")
      .setExpirationTime("15m")
      .sign(secret);
    await expect(verifyAccessToken(token, secret)).resolves.toEqual({
      userId: "u1",
      role: "CLIENT",
      sessionId: "s1",
    });
  });
});

describe("bearerToken", () => {
  it("extrahiert den Token case-insensitiv", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("bearer xyz")).toBe("xyz");
  });

  it("liefert null für fehlende/fremde Header", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Basic dXNlcg==")).toBeNull();
    expect(bearerToken("")).toBeNull();
  });
});

describe("authenticateMobileRequest", () => {
  it("authentifiziert gültige Bearer-Tokens", async () => {
    const { token } = await signAccessToken(payload, { secret });
    await expect(
      authenticateMobileRequest(requestWithAuth(`Bearer ${token}`), secret)
    ).resolves.toEqual({ ok: true, ...payload });
  });

  it("weist fehlende und ungültige Tokens ab", async () => {
    await expect(
      authenticateMobileRequest(requestWithAuth(null), secret)
    ).resolves.toEqual({ ok: false, status: 401, error: "unauthorized" });
    await expect(
      authenticateMobileRequest(requestWithAuth("Bearer kaputt"), secret)
    ).resolves.toEqual({ ok: false, status: 401, error: "unauthorized" });
  });
});

describe("mobileJwtSecret", () => {
  const original = process.env.MOBILE_JWT_SECRET;

  beforeEach(() => {
    // getEnv() validiert die gesamte Env – Pflichtfelder fürs Test-Env setzen
    process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
    resetEnvCache();
  });
  afterEach(() => {
    if (original === undefined) {
      delete process.env.MOBILE_JWT_SECRET;
    } else {
      process.env.MOBILE_JWT_SECRET = original;
    }
    resetEnvCache();
  });

  it("liefert das Env-Secret als Bytes", () => {
    process.env.MOBILE_JWT_SECRET = "env-secret-mindestens-16-zeichen";
    expect(new TextDecoder().decode(mobileJwtSecret())).toBe(
      "env-secret-mindestens-16-zeichen"
    );
  });

  it("wirft ohne Konfiguration", () => {
    delete process.env.MOBILE_JWT_SECRET;
    expect(() => mobileJwtSecret()).toThrow("MOBILE_JWT_SECRET");
  });
});
