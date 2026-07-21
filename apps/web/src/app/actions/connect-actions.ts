"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isStripeEnabled, stripe } from "@/lib/stripe";
import type { ActionResult } from "./auth-actions";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Startet das Stripe-Connect-Onboarding. Kostenlose Controller-Konfiguration:
 * der Creator bekommt ein eigenes Stripe-Konto mit vollem Dashboard und trägt
 * die Stripe-Gebühren selbst – für die Plattform fallen keine Kosten an.
 */
export async function startConnectOnboarding(input: {
  locale: string;
}): Promise<ActionResult & { url?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!isStripeEnabled()) return { ok: false, error: "stripe_disabled" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, stripeAccountId: true },
  });
  if (!user) return { ok: false, error: "unauthorized" };

  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe().accounts.create({
      controller: {
        // Konto zahlt seine Stripe-Gebühren selbst, Stripe trägt das
        // Zahlungsrisiko, volles Stripe-Dashboard für den Creator
        fees: { payer: "account" },
        losses: { payments: "stripe" },
        stripe_dashboard: { type: "full" },
      },
      email: user.email,
      metadata: { userId: session.user.id },
    });
    accountId = account.id;
    await db.user.update({
      where: { id: session.user.id },
      data: { stripeAccountId: accountId },
    });
  }

  const locale = input.locale === "en" ? "en" : "de";
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/${locale}/creator/distribution`,
    return_url: `${appUrl()}/${locale}/creator/distribution?connected=1`,
  });

  return { ok: true, url: link.url };
}

/** Holt den aktuellen Konto-Status von Stripe (charges_enabled). */
export async function refreshConnectStatus(): Promise<
  ActionResult & { chargesEnabled?: boolean }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!isStripeEnabled()) return { ok: false, error: "stripe_disabled" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { stripeAccountId: true },
  });
  if (!user?.stripeAccountId) return { ok: false, error: "not_connected" };

  const account = await stripe().accounts.retrieve(user.stripeAccountId);
  const chargesEnabled = account.charges_enabled === true;

  await db.user.update({
    where: { id: session.user.id },
    data: { stripeChargesEnabled: chargesEnabled },
  });

  revalidatePath("/[locale]/creator/distribution", "page");
  return { ok: true, chargesEnabled };
}
