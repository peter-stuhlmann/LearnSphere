import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MEDIA_SIGN_TTL_MS,
  mediaSignature,
  mediaSignSecret,
  signedMediaUrl,
  verifyMediaSignature,
} from "./media-sign";
import { resetEnvCache } from "./env";

const secret = "media-secret-mindestens-16-zeichen";
const path = "/api/media/v/u1/deadbeef.mp4";

describe("signedMediaUrl/verifyMediaSignature", () => {
  const now = new Date("2026-07-14T12:00:00Z");

  it("roundtrip: signierte URL besteht die Prüfung", () => {
    const url = signedMediaUrl(path, secret, now);
    const parsed = new URL(url, "http://local");
    expect(parsed.pathname).toBe(path);
    expect(Number(parsed.searchParams.get("se"))).toBe(
      now.getTime() + MEDIA_SIGN_TTL_MS
    );
    expect(
      verifyMediaSignature({
        path,
        se: parsed.searchParams.get("se"),
        st: parsed.searchParams.get("st"),
        secret,
        now,
      })
    ).toBe(true);
  });

  it("nutzt die aktuelle Zeit als Default", () => {
    const url = new URL(signedMediaUrl(path, secret), "http://local");
    expect(
      verifyMediaSignature({
        path,
        se: url.searchParams.get("se"),
        st: url.searchParams.get("st"),
        secret,
      })
    ).toBe(true);
  });

  it("lehnt abgelaufene Signaturen ab (Prüfung nur beim Stream-Open)", () => {
    const url = new URL(signedMediaUrl(path, secret, now), "http://local");
    expect(
      verifyMediaSignature({
        path,
        se: url.searchParams.get("se"),
        st: url.searchParams.get("st"),
        secret,
        now: new Date(now.getTime() + MEDIA_SIGN_TTL_MS + 1),
      })
    ).toBe(false);
  });

  it("lehnt manipulierte Pfade, fremde Secrets und kaputte Parameter ab", () => {
    const url = new URL(signedMediaUrl(path, secret, now), "http://local");
    const se = url.searchParams.get("se");
    const st = url.searchParams.get("st");

    expect(
      verifyMediaSignature({ path: "/api/media/v/u2/other.mp4", se, st, secret, now })
    ).toBe(false);
    expect(
      verifyMediaSignature({ path, se, st, secret: "anderes-secret-16-zeichen", now })
    ).toBe(false);
    expect(verifyMediaSignature({ path, se: null, st, secret, now })).toBe(false);
    expect(verifyMediaSignature({ path, se, st: null, secret, now })).toBe(false);
    expect(
      verifyMediaSignature({ path, se: "keine-zahl", st, secret, now })
    ).toBe(false);
    expect(
      verifyMediaSignature({ path, se, st: "zu-kurz", secret, now })
    ).toBe(false);
  });

  it("bindet die Ablaufzeit in die Signatur ein (se-Manipulation fällt auf)", () => {
    const expiresAt = now.getTime() + MEDIA_SIGN_TTL_MS;
    const st = mediaSignature(path, expiresAt, secret);
    expect(
      verifyMediaSignature({
        path,
        se: String(expiresAt + 60_000),
        st,
        secret,
        now,
      })
    ).toBe(false);
  });
});

describe("mediaSignSecret", () => {
  const originalMedia = process.env.MEDIA_SIGN_SECRET;
  const originalMobile = process.env.MOBILE_JWT_SECRET;

  beforeEach(() => {
    process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
    resetEnvCache();
  });
  afterEach(() => {
    if (originalMedia === undefined) delete process.env.MEDIA_SIGN_SECRET;
    else process.env.MEDIA_SIGN_SECRET = originalMedia;
    if (originalMobile === undefined) delete process.env.MOBILE_JWT_SECRET;
    else process.env.MOBILE_JWT_SECRET = originalMobile;
    resetEnvCache();
  });

  it("bevorzugt MEDIA_SIGN_SECRET, fällt auf MOBILE_JWT_SECRET zurück", () => {
    process.env.MEDIA_SIGN_SECRET = "media-secret-mindestens-16-zeichen";
    process.env.MOBILE_JWT_SECRET = "mobile-secret-mindestens-16-zeichen";
    expect(mediaSignSecret()).toBe("media-secret-mindestens-16-zeichen");

    delete process.env.MEDIA_SIGN_SECRET;
    resetEnvCache();
    expect(mediaSignSecret()).toBe("mobile-secret-mindestens-16-zeichen");
  });

  it("wirft ohne Konfiguration", () => {
    delete process.env.MEDIA_SIGN_SECRET;
    delete process.env.MOBILE_JWT_SECRET;
    resetEnvCache();
    expect(() => mediaSignSecret()).toThrow("nicht konfiguriert");
  });
});
