import { generateSecret, generateURI, verifySync } from "otplib";

export const TOTP_ISSUER = "LearnSphere";

export function generateTotpSecret(): string {
  return generateSecret();
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return verifySync({ token, secret }).valid;
  } catch {
    return false;
  }
}

export function buildOtpAuthUrl(accountEmail: string, secret: string): string {
  return generateURI({ issuer: TOTP_ISSUER, label: accountEmail, secret });
}

/**
 * Aktueller TOTP-Zeitschritt (30-s-Fenster). Wird nach erfolgreichem Login
 * gespeichert – ein erneut eingespielter Code desselben Fensters wird
 * abgelehnt (Replay-Schutz).
 */
export function currentTotpStep(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 1000 / 30);
}
