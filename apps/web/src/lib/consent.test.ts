import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  parseConsent,
  serializeConsent,
} from "./consent";

describe("consent", () => {
  const NOW = new Date("2026-07-13T12:00:00Z");

  it("serialisiert und parst eine Einwilligung", () => {
    const raw = serializeConsent(true, NOW);
    expect(parseConsent(raw)).toEqual({
      version: CONSENT_VERSION,
      analytics: true,
      decidedAt: NOW.toISOString(),
    });
  });

  it("parst eine Ablehnung", () => {
    expect(parseConsent(serializeConsent(false, NOW))?.analytics).toBe(false);
  });

  it("verwirft fehlende, kaputte und fremdformatige Werte", () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("kein json")).toBeNull();
    expect(parseConsent("{}")).toBeNull();
    expect(
      parseConsent(JSON.stringify({ version: CONSENT_VERSION }))
    ).toBeNull();
    expect(
      parseConsent(
        JSON.stringify({ version: CONSENT_VERSION, analytics: "ja", decidedAt: "x" })
      )
    ).toBeNull();
  });

  it("verwirft alte Versionen (erneut fragen)", () => {
    expect(
      parseConsent(
        JSON.stringify({
          version: CONSENT_VERSION - 1,
          analytics: true,
          decidedAt: NOW.toISOString(),
        })
      )
    ).toBeNull();
  });
});
