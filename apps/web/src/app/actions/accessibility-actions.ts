"use server";

import { headers } from "next/headers";
import { sendMail } from "@/lib/mail";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildAccessibilityMail } from "@/lib/accessibility-feedback";
import type { ActionResult } from "./auth-actions";

/**
 * Meldung über eine Barriere. Bewusst ohne Anmeldepflicht – wer die Seite
 * nicht bedienen kann, soll sich nicht erst registrieren müssen.
 */
export async function sendAccessibilityFeedback(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  page?: string;
}): Promise<ActionResult> {
  const built = buildAccessibilityMail(input);
  if (!built.ok) return { ok: false, error: built.error };

  /* Ohne Anmeldung braucht es eine Bremse: max. 5 Meldungen pro Stunde je
     IP. Der Schlüssel hängt an der IP, nicht an der Adresse – sonst könnte
     man mit wechselnden Absendern beliebig oft senden. */
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (
    !(await checkRateLimit(`a11y-feedback:${ip}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    }))
  ) {
    return { ok: false, error: "too_many_attempts" };
  }

  await sendMail({ ...built.mail, sender: "hello" });
  return { ok: true };
}
