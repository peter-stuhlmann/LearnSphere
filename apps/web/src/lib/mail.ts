import nodemailer from "nodemailer";

interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /**
   * Absender-Postfach (Local-Part) laut RESEND_FROM-Vorlage, z. B.
   * "noreply" (Default), "hello", "newsletter", "billing".
   */
  sender?: string;
  /**
   * Antwortadresse. Wird bei Meldungen von Nutzern gesetzt, damit man
   * direkt aus dem Postfach heraus antworten kann – der Absender bleibt
   * die eigene Domain (sonst scheitert SPF/DKIM).
   */
  replyTo?: string;
}

/**
 * Absender aus der RESEND_FROM-Vorlage auflösen: Das "XXX" darin wird
 * durch das gewünschte Postfach ersetzt ("LearnSphere <XXX@learnsphere.one>"
 * → "LearnSphere <newsletter@learnsphere.one>").
 */
function resolveFrom(sender: string): string {
  const template = process.env.RESEND_FROM;
  if (template?.includes("XXX")) return template.replaceAll("XXX", sender);
  if (template) return template;
  return process.env.MAIL_FROM ?? "no-reply@localhost";
}

/**
 * Versendet E-Mails, bevorzugt über die Resend-API (RESEND_API_KEY),
 * sonst über klassisches SMTP. Ohne beides (lokale Entwicklung) wird die
 * Mail in die Konsole geloggt. Ist RESEND_OVERRIDE_TO gesetzt, gehen ALLE
 * Mails an diese Adresse (Testschutz – niemand bekommt versehentlich Post).
 */
export async function sendMail(input: MailInput): Promise<void> {
  const from = resolveFrom(input.sender ?? "noreply");
  const override = process.env.RESEND_OVERRIDE_TO;
  const to = override || input.to;
  const subject =
    override && override !== input.to
      ? `[an: ${input.to}] ${input.subject}`
      : input.subject;

  // Platzhalter "re_" gilt als nicht konfiguriert (sonst gingen Mails
  // mit ungültigem Key verloren statt in den Dev-Log)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey.length > 8) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        console.error(
          "[mail] Resend-Fehler:",
          response.status,
          (await response.text()).slice(0, 300)
        );
      }
    } catch (err) {
      console.error("[mail] Resend fehlgeschlagen:", err);
    }
    return;
  }

  if (!process.env.SMTP_HOST) {
    console.info(
      `\n📧 [DEV-MAIL] Von: ${from} An: ${to}\nBetreff: ${subject}\n\n${input.text}\n`
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
  });
}
