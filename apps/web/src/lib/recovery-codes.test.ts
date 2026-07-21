import { describe, expect, it } from "vitest";
import {
  RECOVERY_CODE_COUNT,
  consumeRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  parseStoredHashes,
} from "./recovery-codes";

describe("generateRecoveryCodes", () => {
  it("liefert 8 eindeutige Codes im Format XXXXX-XXXXX", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-KM-NP-TV-Z2-9]{5}-[A-HJ-KM-NP-TV-Z2-9]{5}$/);
    }
  });

  it("respektiert eine abweichende Anzahl", () => {
    expect(generateRecoveryCodes(3)).toHaveLength(3);
  });
});

describe("normalizeRecoveryCode / hashRecoveryCode", () => {
  it("ignoriert Bindestriche, Leerraum und Kleinschreibung", () => {
    expect(normalizeRecoveryCode(" abcde-23456 ")).toBe("ABCDE23456");
    expect(hashRecoveryCode("abcde-23456")).toBe(
      hashRecoveryCode("ABCDE 23456")
    );
  });
});

describe("parseStoredHashes", () => {
  it("liest nur nichtleere Strings aus dem Json-Feld", () => {
    expect(parseStoredHashes(["a", "", 5, null, "b"])).toEqual(["a", "b"]);
    expect(parseStoredHashes(null)).toEqual([]);
    expect(parseStoredHashes("kaputt")).toEqual([]);
  });
});

describe("consumeRecoveryCode", () => {
  const codes = generateRecoveryCodes();
  const hashes = codes.map((code) => hashRecoveryCode(code));

  it("verbraucht einen gültigen Code genau einmal", () => {
    const remaining = consumeRecoveryCode(codes[0], hashes);
    expect(remaining).toHaveLength(hashes.length - 1);
    expect(remaining).not.toContain(hashRecoveryCode(codes[0]));
    // zweiter Versuch mit demselben Code scheitert
    expect(consumeRecoveryCode(codes[0], remaining!)).toBeNull();
  });

  it("lehnt fremde und zu kurze Eingaben ab (TOTP-Codes werden nie gehasht)", () => {
    expect(consumeRecoveryCode("AAAAA-AAAAA", hashes)).toBeNull();
    expect(consumeRecoveryCode("123456", hashes)).toBeNull();
    expect(consumeRecoveryCode("", hashes)).toBeNull();
  });
});
