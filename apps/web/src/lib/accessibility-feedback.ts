import { z } from "zod";

/**
 * Barrierefreiheits-Feedback: Prüfung der Eingaben und Aufbau der Mail.
 *
 * Bewusst frei von Netzwerk und Datenbank – der Versand liegt in der
 * Server-Action. So lässt sich das Heikle (Betreff-Präfix, Kürzung,
 * Zeilenumbrüche im Betreff) direkt testen.
 */

/** Postfach, das Barrieremeldungen entgegennimmt */
export const ACCESSIBILITY_INBOX = "accessibility@learnsphere.one";

/** Intern trägt jede Meldung dieses Präfix im Betreff */
export const SUBJECT_PREFIX = "LearnSphere | ";

const MAX_NAME = 120;
const MAX_SUBJECT = 160;
const MAX_MESSAGE = 5000;

export type AccessibilityFeedbackError =
  | "name_required"
  | "email_invalid"
  | "subject_required"
  | "message_required";

const schema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME),
  email: z.email(),
  subject: z.string().trim().min(1).max(MAX_SUBJECT),
  message: z.string().trim().min(1).max(MAX_MESSAGE),
});

export interface AccessibilityMail {
  to: string;
  subject: string;
  text: string;
  replyTo: string;
}

/**
 * Betreff für den Versand: immer mit Präfix, ohne Zeilenumbrüche und
 * gekürzt. Zeilenumbrüche in einem Mail-Header wären eine Header-Injection –
 * sie werden entfernt, nicht escaped.
 */
export function buildSubject(raw: string): string {
  const clean = raw.replace(/[\r\n]+/g, " ").trim().slice(0, MAX_SUBJECT);
  return `${SUBJECT_PREFIX}${clean}`;
}

/**
 * Eingaben prüfen und die fertige Mail bauen. Fehlerschlüssel sind
 * absichtlich grob – sie werden im Formular übersetzt.
 */
export function buildAccessibilityMail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Seite, von der die Meldung kam – hilft beim Nachstellen */
  page?: string;
}):
  | { ok: true; mail: AccessibilityMail }
  | { ok: false; error: AccessibilityFeedbackError } {
  const parsed = schema.safeParse({
    name: input.name,
    email: input.email.trim().toLowerCase(),
    subject: input.subject,
    message: input.message,
  });

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "email") return { ok: false, error: "email_invalid" };
    if (field === "subject") return { ok: false, error: "subject_required" };
    if (field === "message") return { ok: false, error: "message_required" };
    return { ok: false, error: "name_required" };
  }

  const { name, email, subject, message } = parsed.data;
  const lines = [
    `Name:    ${name}`,
    `E-Mail:  ${email}`,
    input.page ? `Seite:   ${input.page}` : null,
    "",
    message,
  ].filter((line) => line !== null);

  return {
    ok: true,
    mail: {
      to: ACCESSIBILITY_INBOX,
      subject: buildSubject(subject),
      text: lines.join("\n"),
      replyTo: email,
    },
  };
}
