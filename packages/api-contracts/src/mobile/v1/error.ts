import { z } from "zod";

/**
 * Einheitlicher Fehler-Envelope der Mobile-API: Der Server sendet nur
 * Fehler-CODES (keine lokalisierten Texte) – die App übersetzt selbst.
 * Die Codes entsprechen den ActionResult-Strings des Web-Backends.
 */

export const MOBILE_ERROR_CODES = [
  "unauthorized",
  "token_expired",
  "invalid_credentials",
  "2fa_required",
  "2fa_invalid",
  "too_many_attempts",
  "refresh_invalid",
  "refresh_reuse_detected",
  "terms_required",
  "email_taken",
  "token_invalid",
  "validation_failed",
  "not_found",
  "not_enrolled",
  "payment_required",
  "rate_limited",
  "upgrade_required",
  "internal_error",
] as const;

export type MobileErrorCode = (typeof MOBILE_ERROR_CODES)[number];

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(MOBILE_ERROR_CODES),
    /// Optionale Detailangaben (z. B. zod-Issue-Pfade bei validation_failed)
    details: z.array(z.string()).optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export function errorEnvelope(
  code: MobileErrorCode,
  details?: string[]
): ErrorEnvelope {
  return { error: details ? { code, details } : { code } };
}
