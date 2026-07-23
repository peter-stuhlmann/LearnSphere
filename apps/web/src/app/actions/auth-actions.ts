"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { auth, signIn } from "@/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { buildEmail } from "@/lib/email-template";
import { generateToken, hashToken, isExpired } from "@/lib/tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildOtpAuthUrl, generateTotpSecret, verifyTotp } from "@/lib/totp";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
} from "@/lib/recovery-codes";
import { passwordSchema, registerSchema } from "@elearning/core/validation";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 Stunde
const VERIFY_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 Stunden

/** Verifizierungs-Mail (Double-Opt-In) erzeugen und verschicken. */
async function sendVerificationMail(
  userId: string,
  email: string,
  locale: string
): Promise<void> {
  const token = generateToken();
  await db.emailVerifyToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
  });

  const t = await getTranslations({
    locale,
    namespace: "mail.verify",
  });
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/${locale === "de" ? "email-bestaetigen" : "verify-email"}?token=${token}`;

  const mail = buildEmail({
    locale,
    preview: t("preview"),
    heading: t("heading"),
    paragraphs: [t("intro")],
    button: { label: t("button"), url },
    note: t("note"),
  });
  await sendMail({
    to: email,
    subject: t("subject"),
    text: mail.text,
    html: mail.html,
  });
}

/**
 * OAuth-Anmeldung (Google/LinkedIn) starten – wirft den Auth.js-Redirect
 * zum Provider. Funktioniert, sobald die Client-Daten in der .env stehen.
 */
export async function oauthSignIn(
  provider: "google" | "linkedin",
  locale: string
): Promise<void> {
  await signIn(provider, {
    redirectTo: `/${locale === "en" ? "en" : "de"}`,
  });
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  locale: string;
}): Promise<ActionResult> {
  // AGB-Einbeziehung serverseitig erzwingen (Checkbox im Formular)
  if (input.acceptTerms !== true) {
    return { ok: false, error: "terms_required" };
  }
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  // max. 5 Registrierungen pro E-Mail-Adresse und Stunde
  if (
    !(await checkRateLimit(`register:${parsed.data.email}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    }))
  ) {
    return { ok: false, error: "too_many_attempts" };
  }

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "email_taken" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const locale = input.locale === "en" ? "en" : "de";
  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      locale,
    },
  });

  // Double-Opt-In: Login ist erst nach Bestätigung möglich. Scheitert der
  // Mailversand, bleibt das Konto bestehen – „erneut senden" auf der
  // Login-Seite holt das nach.
  try {
    await sendVerificationMail(user.id, user.email, locale);
  } catch (error) {
    console.error("[auth] Verifizierungs-Mail fehlgeschlagen:", error);
  }

  return { ok: true };
}

/**
 * Verifizierungs-Link einlösen: Token prüfen, E-Mail als bestätigt
 * markieren. Bereits bestätigte Konten melden Erfolg (idempotent).
 */
export async function confirmEmail(token: string): Promise<ActionResult> {
  const record = await db.emailVerifyToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, emailVerified: true } } },
  });
  if (!record) return { ok: false, error: "token_invalid" };
  if (record.user.emailVerified) return { ok: true };
  if (record.usedAt || isExpired(record.expires)) {
    return { ok: false, error: "token_invalid" };
  }

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    db.emailVerifyToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

/**
 * Verifizierungs-Mail erneut anfordern. Antwortet immer mit Erfolg,
 * damit keine Konten enumeriert werden können.
 */
export async function resendVerification(input: {
  email: string;
  locale: string;
}): Promise<ActionResult> {
  const email = input.email.trim().toLowerCase();

  // gegen Mail-Bombing: max. 3 Mails pro Adresse und Stunde
  if (
    !(await checkRateLimit(`verify:${email}`, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    }))
  ) {
    return { ok: true };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true, locale: true },
  });
  if (!user || user.emailVerified) return { ok: true };

  try {
    await sendVerificationMail(
      user.id,
      user.email,
      input.locale === "en" ? "en" : "de"
    );
  } catch (error) {
    console.error("[auth] Verifizierungs-Mail fehlgeschlagen:", error);
  }
  return { ok: true };
}

export async function requestPasswordReset(input: {
  email: string;
  locale: string;
}): Promise<ActionResult> {
  const email = input.email.trim().toLowerCase();

  // max. 3 Reset-Mails pro Adresse und Stunde (gegen Mail-Bombing)
  if (
    !(await checkRateLimit(`reset:${email}`, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    }))
  ) {
    return { ok: true }; // bewusst gleiche Antwort – keine Enumeration
  }

  const user = await db.user.findUnique({ where: { email } });

  // Immer Erfolg melden, damit keine Konten enumeriert werden können.
  if (!user) {
    return { ok: true };
  }

  const token = generateToken();
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const t = await getTranslations({
    locale: input.locale,
    namespace: "mail.reset",
  });
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/${input.locale}/reset-password?token=${token}`;

  const mail = buildEmail({
    locale: input.locale,
    preview: t("preview"),
    heading: t("heading"),
    paragraphs: [t("intro")],
    button: { label: t("button"), url },
    note: t("note"),
  });
  await sendMail({
    to: email,
    subject: t("subject"),
    text: mail.text,
    html: mail.html,
  });

  return { ok: true };
}

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<ActionResult> {
  const parsedPassword = passwordSchema.safeParse(input.password);
  if (!parsedPassword.success) {
    return {
      ok: false,
      error: parsedPassword.error.issues[0]?.message ?? "invalid",
    };
  }

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });
  if (!record || record.usedAt || isExpired(record.expires)) {
    return { ok: false, error: "token_invalid" };
  }

  const passwordHash = await bcrypt.hash(parsedPassword.data, 12);
  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

export async function startTotpSetup(): Promise<
  ActionResult & { otpAuthUrl?: string; qrDataUrl?: string; secret?: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return { ok: false, error: "unauthorized" };
  }
  if (user.totpEnabled) {
    return { ok: false, error: "totp_already_enabled" };
  }

  const secret = generateTotpSecret();
  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnabled: false },
  });

  const otpAuthUrl = buildOtpAuthUrl(user.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, { margin: 1, width: 240 });

  return { ok: true, otpAuthUrl, qrDataUrl, secret };
}

export async function confirmTotpSetup(input: {
  token: string;
}): Promise<ActionResult & { recoveryCodes?: string[] }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.totpSecret) {
    return { ok: false, error: "totp_not_initialized" };
  }

  if (!verifyTotp(input.token, user.totpSecret)) {
    return { ok: false, error: "totp_invalid" };
  }

  // Wiederherstellungscodes: einmalig im Klartext zurückgeben,
  // gespeichert werden nur die Hashes
  const recoveryCodes = generateRecoveryCodes();
  await db.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: true,
      totpRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
    },
  });

  return { ok: true, recoveryCodes };
}

/**
 * Neue Wiederherstellungscodes erzeugen (Passwort-Bestätigung nötig).
 * Alte Codes werden dabei ungültig.
 */
export async function regenerateRecoveryCodes(input: {
  password: string;
}): Promise<ActionResult & { recoveryCodes?: string[] }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash || !user.totpEnabled) {
    return { ok: false, error: "unauthorized" };
  }
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "invalid_credentials" };
  }

  const recoveryCodes = generateRecoveryCodes();
  await db.user.update({
    where: { id: user.id },
    data: { totpRecoveryCodes: recoveryCodes.map(hashRecoveryCode) },
  });

  return { ok: true, recoveryCodes };
}

export async function disableTotp(input: {
  password: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) {
    return { ok: false, error: "unauthorized" };
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "invalid_credentials" };
  }

  await db.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, totpRecoveryCodes: [] },
  });

  return { ok: true };
}
