import { createHash, randomInt } from "node:crypto";

/**
 * 2FA-Wiederherstellungscodes: Wer sein Authenticator-Gerät verliert, kommt
 * mit einem Einmal-Code wieder ins Konto. Gespeichert werden ausschließlich
 * SHA-256-Hashes; jeder Code ist nach Benutzung verbraucht.
 */

export const RECOVERY_CODE_COUNT = 8;

/** Alphabet ohne verwechselbare Zeichen (kein I/O/0/1/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const GROUP = 5;

/** Kryptographisch zufällige Codes im Format "XXXXX-XXXXX". */
export function generateRecoveryCodes(
  count: number = RECOVERY_CODE_COUNT
): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    let raw = "";
    for (let i = 0; i < GROUP * 2; i++) {
      raw += ALPHABET[randomInt(ALPHABET.length)];
    }
    codes.add(`${raw.slice(0, GROUP)}-${raw.slice(GROUP)}`);
  }
  return [...codes];
}

/** Eingabe normalisieren: Groß, ohne Trennzeichen/Leerraum. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/** Gespeicherte Hash-Liste (Prisma-Json) defensiv einlesen. */
export function parseStoredHashes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0
  );
}

/**
 * Code einlösen: passt die Eingabe zu einem gespeicherten Hash, kommt die
 * Liste OHNE diesen Hash zurück (einmal verwendbar); sonst null.
 */
export function consumeRecoveryCode(
  input: string,
  storedHashes: string[]
): string[] | null {
  const normalized = normalizeRecoveryCode(input);
  // Recovery-Codes sind 10 Zeichen – kurze Eingaben (TOTP) gar nicht hashen
  if (normalized.length !== GROUP * 2) return null;
  const hash = hashRecoveryCode(normalized);
  if (!storedHashes.includes(hash)) return null;
  return storedHashes.filter((stored) => stored !== hash);
}
