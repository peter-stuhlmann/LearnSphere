import { describe, expect, it } from "vitest";
import {
  canRequestPayout,
  EARNINGS_HOLD_DAYS,
  earningsClearedCutoff,
  isValidIban,
  maskIban,
  MIN_PAYOUT_CENTS,
  normalizeIban,
} from "./payout";

describe("earningsClearedCutoff", () => {
  it("is exactly 30 days before now", () => {
    expect(EARNINGS_HOLD_DAYS).toBe(30);
    const now = new Date("2026-07-31T12:00:00Z");
    expect(earningsClearedCutoff(now).toISOString()).toBe(
      "2026-07-01T12:00:00.000Z"
    );
  });

  it("a sale from 31 days ago is cleared, one from 29 days ago is not", () => {
    const now = new Date("2026-07-31T12:00:00Z");
    const cutoff = earningsClearedCutoff(now);
    const old = new Date("2026-06-30T12:00:00Z");
    const recent = new Date("2026-07-02T12:00:00Z");
    expect(old.getTime() <= cutoff.getTime()).toBe(true);
    expect(recent.getTime() <= cutoff.getTime()).toBe(false);
  });
});

describe("normalizeIban", () => {
  it("removes spaces and uppercases", () => {
    expect(normalizeIban("de89 3704 0044 0532 0130 00")).toBe(
      "DE89370400440532013000"
    );
  });
});

describe("isValidIban", () => {
  it("accepts valid IBANs (Mod-97-Prüfsumme)", () => {
    expect(isValidIban("DE89370400440532013000")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("AT611904300234573201")).toBe(true);
    expect(isValidIban("CH9300762011623852957")).toBe(true);
  });

  it("rejects IBANs with wrong checksum", () => {
    expect(isValidIban("DE89370400440532013001")).toBe(false);
    expect(isValidIban("DE00370400440532013000")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isValidIban("")).toBe(false);
    expect(isValidIban("KEINE-IBAN")).toBe(false);
    expect(isValidIban("DE89")).toBe(false);
    expect(isValidIban("1289370400440532013000")).toBe(false);
  });
});

describe("maskIban", () => {
  it("shows country, start and end only", () => {
    expect(maskIban("DE89370400440532013000")).toBe("DE89 •••• 3000");
  });
});

describe("canRequestPayout", () => {
  it("requires at least 10 euros", () => {
    expect(MIN_PAYOUT_CENTS).toBe(1000);
    expect(
      canRequestPayout({ balanceCents: 999, hasOpenRequest: false, hasIban: true })
    ).toEqual({ ok: false, error: "below_minimum" });
    expect(
      canRequestPayout({ balanceCents: 1000, hasOpenRequest: false, hasIban: true })
    ).toEqual({ ok: true });
  });

  it("requires bank details", () => {
    expect(
      canRequestPayout({ balanceCents: 5000, hasOpenRequest: false, hasIban: false })
    ).toEqual({ ok: false, error: "no_bank_account" });
  });

  it("allows only one open request at a time", () => {
    expect(
      canRequestPayout({ balanceCents: 5000, hasOpenRequest: true, hasIban: true })
    ).toEqual({ ok: false, error: "request_pending" });
  });
});
