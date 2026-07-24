import { z } from "zod";
import { normalizeCouponCode } from "@elearning/core/coupon";

/**
 * Eingabe-Validierung für den Headless-Checkout der Creator-API
 * (POST /api/v1/checkout). Reine Logik ohne DB/Stripe – die Route macht
 * die Autorisierung, das Fulfillment läuft über den Stripe-Webhook.
 */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Rücksprung-URLs der Integratoren: https ist Pflicht – unverschlüsseltes
 * http nur für localhost (lokale Entwicklung der Integratoren).
 */
export function isValidReturnUrl(value: string): boolean {
  if (value.length > 2000) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOCAL_HOSTNAMES.has(url.hostname);
}

/**
 * Kleiner In-Memory-Cache mit Ablaufzeit – macht wiederholte
 * Checkout-Anfragen idempotent (gleiche Anfrage → gleiche Stripe-URL,
 * solange die Session frisch ist). Ein Prozess = ein Cache, wie beim
 * Rate-Limiter dieser Instanz.
 */
export class TtlCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private ttlMs: number,
    private now: () => number = Date.now
  ) {}

  get(key: string): T | undefined {
    this.prune();
    const entry = this.store.get(key);
    if (!entry) return undefined;
    return entry.value;
  }

  set(key: string, value: T): void {
    this.prune();
    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  get size(): number {
    return this.store.size;
  }

  private prune(): void {
    const now = this.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }
}

/**
 * Stripe ersetzt {CHECKOUT_SESSION_ID} in der success_url – damit kann die
 * Integrator-Seite den Kauf serverseitig verifizieren. Wer den Platzhalter
 * nicht selbst setzt, bekommt ihn als session_id-Parameter angehängt.
 */
export function withSessionPlaceholder(url: string): string {
  if (url.includes("{CHECKOUT_SESSION_ID}")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}session_id={CHECKOUT_SESSION_ID}`;
}

const returnUrl = z
  .string()
  .refine(isValidReturnUrl, "invalid_return_url");

export const apiCheckoutSchema = z.object({
  /** Kurs-Slug – der Kurs muss dem Key-Inhaber gehören */
  course: z.string().trim().min(1).max(191),
  /** E-Mail der Käufer:in – Konto wird beim Fulfillment angelegt/gefunden */
  email: z
    .email("email_invalid")
    .max(191)
    .transform((value) => value.toLowerCase()),
  successUrl: returnUrl,
  cancelUrl: returnUrl,
  /** Sprache für Stripe-Checkout und ggf. neu angelegtes Konto */
  locale: z.enum(["de", "en"]).default("de"),
  /** Gutschein-Code des Kurses – wird serverseitig validiert und angewendet */
  couponCode: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform(normalizeCouponCode)
    .optional(),
});

export type ApiCheckoutInput = z.infer<typeof apiCheckoutSchema>;
