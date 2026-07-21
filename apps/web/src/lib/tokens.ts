import { createHash, randomBytes } from "node:crypto";

/** Cryptographically random token, sent to the user (e.g. via e-mail). */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Only the hash of a token is stored in the database. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isExpired(expires: Date, now: Date = new Date()): boolean {
  return expires.getTime() <= now.getTime();
}
