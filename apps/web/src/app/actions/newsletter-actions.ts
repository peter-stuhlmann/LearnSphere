"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { sendMail } from "@/lib/mail";
import { buildEmail } from "@/lib/email-template";
import { generateToken, hashToken } from "@/lib/tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./auth-actions";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

const emailSchema = z.email();

/**
 * Newsletter-Anmeldung mit Double-Opt-in (rechtssicher): Es wird erst ein
 * Bestätigungslink verschickt; abonniert ist man nach dem Klick. Der
 * gleiche Token dient später als Abmeldelink in jeder Mail.
 */
export async function subscribeNewsletter(input: {
  email: string;
  locale: string;
}): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input.email.trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "email_invalid" };
  const email = parsed.data;
  const locale = input.locale === "en" ? "en" : "de";

  // gegen Mail-Bombing: max. 3 Anmeldeversuche pro Adresse und Stunde
  if (
    !(await checkRateLimit(`newsletter:${email}`, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    }))
  ) {
    return { ok: false, error: "too_many_attempts" };
  }

  const existing = await db.newsletterSubscriber.findUnique({
    where: { email },
  });
  if (existing?.confirmedAt && !existing.unsubscribedAt) {
    // schon dabei – nach außen identisch antworten (keine Adress-Orakel)
    return { ok: true };
  }

  const token = generateToken();
  await db.newsletterSubscriber.upsert({
    where: { email },
    create: { email, locale, tokenHash: hashToken(token) },
    update: { locale, tokenHash: hashToken(token), unsubscribedAt: null },
  });

  const confirmUrl = `${appUrl()}/${locale}/newsletter/confirm?token=${token}`;
  const t = await getTranslations({ locale, namespace: "mail.newsletter" });
  const mail = buildEmail({
    locale,
    preview: t("preview"),
    heading: t("heading"),
    paragraphs: [t("intro")],
    button: { label: t("button"), url: confirmUrl },
    note: t("note"),
  });
  await sendMail({
    to: email,
    sender: "newsletter",
    subject: t("subject"),
    text: mail.text,
    html: mail.html,
  });

  return { ok: true };
}

/** Bestätigt das Abo über den Mail-Link. */
export async function confirmNewsletter(token: string): Promise<ActionResult> {
  if (!token) return { ok: false, error: "invalid" };
  const subscriber = await db.newsletterSubscriber.findFirst({
    where: { tokenHash: hashToken(token) },
  });
  if (!subscriber) return { ok: false, error: "invalid" };

  await db.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { confirmedAt: subscriber.confirmedAt ?? new Date() },
  });
  return { ok: true };
}

/** Meldet über den Mail-Link ab (Pflicht-Link in jeder Newsletter-Mail). */
export async function unsubscribeNewsletter(
  token: string
): Promise<ActionResult> {
  if (!token) return { ok: false, error: "invalid" };
  const subscriber = await db.newsletterSubscriber.findFirst({
    where: { tokenHash: hashToken(token) },
  });
  if (!subscriber) return { ok: false, error: "invalid" };

  await db.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { unsubscribedAt: new Date() },
  });
  return { ok: true };
}
