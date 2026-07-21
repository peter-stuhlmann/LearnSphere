import { describe, expect, it } from "vitest";
import {
  evaluateRefresh,
  generateRefreshToken,
  refreshExpiry,
  REFRESH_TOKEN_TTL_MS,
} from "./mobile-session";

describe("generateRefreshToken", () => {
  it("liefert 64 Hex-Zeichen und ist zufällig", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("refreshExpiry", () => {
  it("liegt 60 Tage in der Zukunft", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(refreshExpiry(now).getTime()).toBe(
      now.getTime() + REFRESH_TOKEN_TTL_MS
    );
  });
});

describe("evaluateRefresh", () => {
  const now = new Date("2026-01-10T12:00:00Z");
  const future = new Date("2026-03-01T00:00:00Z");
  const past = new Date("2026-01-01T00:00:00Z");

  it("unbekannter Token → reject/unknown", () => {
    expect(evaluateRefresh(null, now)).toEqual({
      action: "reject",
      reason: "unknown",
    });
  });

  it("bereits rotierter Token → Familie widerrufen (Reuse-Detection)", () => {
    expect(
      evaluateRefresh({ revokedAt: past, expiresAt: future }, now)
    ).toEqual({ action: "revoke_family", reason: "reuse" });
  });

  it("abgelaufener Token → reject/expired", () => {
    expect(
      evaluateRefresh({ revokedAt: null, expiresAt: past }, now)
    ).toEqual({ action: "reject", reason: "expired" });
  });

  it("gültiger Token → rotate", () => {
    expect(
      evaluateRefresh({ revokedAt: null, expiresAt: future }, now)
    ).toEqual({ action: "rotate" });
  });
});
