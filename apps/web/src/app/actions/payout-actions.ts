"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  canRequestPayout,
  isValidIban,
  normalizeIban,
} from "@elearning/core/payout";
import { attemptAutoTransfer, loadPayoutSummary } from "@/lib/payout-server";
import type { ActionResult } from "./auth-actions";

export async function savePayoutAccount(input: {
  holder: string;
  iban: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const holder = input.holder.trim();
  if (holder.length < 3) return { ok: false, error: "holder_required" };
  if (!isValidIban(input.iban)) return { ok: false, error: "iban_invalid" };

  await db.user.update({
    where: { id: session.user.id },
    data: {
      payoutHolder: holder,
      payoutIban: normalizeIban(input.iban),
    },
  });

  revalidatePath("/[locale]/creator/distribution", "page");
  return { ok: true };
}

export async function requestPayout(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  // Serverseitige Prüfung: min. 10 €, Bankdaten vorhanden, kein offener Antrag
  const summary = await loadPayoutSummary(session.user.id);
  const check = canRequestPayout({
    balanceCents: summary.balanceCents,
    hasOpenRequest: summary.hasOpenRequest,
    hasIban: Boolean(summary.iban),
  });
  if (!check.ok) {
    return { ok: false, error: check.error };
  }

  const payout = await db.payout.create({
    data: {
      userId: session.user.id,
      amountCents: summary.balanceCents,
      holder: summary.holder,
      iban: summary.iban,
    },
  });

  // Mit Stripe Connect verbundene Creator werden sofort automatisch
  // ausgezahlt; alle anderen landen in der Admin-Warteschlange
  await attemptAutoTransfer(payout.id);

  revalidatePath("/[locale]/creator/distribution", "page");
  return { ok: true };
}
