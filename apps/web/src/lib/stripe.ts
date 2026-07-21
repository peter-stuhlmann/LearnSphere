import Stripe from "stripe";

/**
 * Stripe ist optional konfiguriert: ohne STRIPE_SECRET_KEY läuft die
 * Plattform im Demo-Checkout-Modus (lokale Entwicklung ohne Keys).
 */
export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

/** API-Zugriff: 25 €/Monat oder 240 €/Jahr (= 20 €/Monat). */
export const API_PLAN = {
  name: "LearnSphere API-Zugriff",
  MONTH: { amountCents: 2500, interval: "month" as const },
  YEAR: { amountCents: 24000, interval: "year" as const },
};

