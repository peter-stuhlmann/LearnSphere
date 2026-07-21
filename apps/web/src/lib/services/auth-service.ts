import bcrypt from "bcryptjs";
import { loginSchema } from "@elearning/core/validation";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  consumeRecoveryCode,
  parseStoredHashes,
} from "@/lib/recovery-codes";
import { currentTotpStep, verifyTotp } from "@/lib/totp";

/**
 * Gemeinsame Credential-Prüfung für Web (NextAuth authorize) und Mobile
 * (POST /api/mobile/v1/auth/login): zod-Validierung, Brute-Force-Bremse,
 * bcrypt-Vergleich, optionaler TOTP-Schritt inkl. Replay-Schutz.
 */

export interface VerifiedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  locale: string;
  totpEnabled: boolean;
}

export type CredentialCheck =
  | { ok: true; user: VerifiedUser }
  | {
      ok: false;
      error:
        | "invalid_credentials"
        | "email_not_verified"
        | "2fa_required"
        | "2fa_invalid"
        | "too_many_attempts";
    };

export async function verifyCredentials(
  credentials: unknown
): Promise<CredentialCheck> {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) {
    return { ok: false, error: "invalid_credentials" };
  }
  const { email, password, totp } = parsed.data;

  // Brute-Force-Bremse: max. 10 Versuche pro Konto in 10 Minuten.
  // Gemeinsamer Key mit dem Web-Login – ein Angreifer bekommt über die
  // Mobile-API kein zweites Versuchsbudget.
  if (
    !(await checkRateLimit(`login:${email}`, {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    }))
  ) {
    return { ok: false, error: "too_many_attempts" };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    return { ok: false, error: "invalid_credentials" };
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return { ok: false, error: "invalid_credentials" };
  }

  // Double-Opt-In: erst nach korrektem Passwort prüfen, damit der
  // Verifikationsstatus fremder Konten nicht enumerierbar ist
  if (!user.emailVerified) {
    return { ok: false, error: "email_not_verified" };
  }

  if (user.totpEnabled && user.totpSecret) {
    if (!totp) {
      return { ok: false, error: "2fa_required" };
    }
    if (verifyTotp(totp, user.totpSecret)) {
      // Replay-Schutz: jeder 30-s-Zeitschritt ist nur einmal verwendbar
      const step = currentTotpStep();
      if (user.totpLastUsedStep !== null && step <= user.totpLastUsedStep) {
        return { ok: false, error: "2fa_invalid" };
      }
      await db.user.update({
        where: { id: user.id },
        data: { totpLastUsedStep: step },
      });
    } else {
      // Kein TOTP? Dann evtl. ein Wiederherstellungscode (Gerät verloren) –
      // jeder Code ist nur einmal einlösbar
      const remaining = consumeRecoveryCode(
        totp,
        parseStoredHashes(user.totpRecoveryCodes)
      );
      if (remaining === null) {
        return { ok: false, error: "2fa_invalid" };
      }
      await db.user.update({
        where: { id: user.id },
        data: { totpRecoveryCodes: remaining },
      });
    }
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      locale: user.locale,
      totpEnabled: user.totpEnabled,
    },
  };
}
