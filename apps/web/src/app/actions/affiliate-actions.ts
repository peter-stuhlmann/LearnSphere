"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "./auth-actions";

/**
 * Beitritt zum Affiliate-Programm: nur mit akzeptierten Bedingungen,
 * idempotent, Code kryptografisch zufällig und eindeutig.
 */
export async function joinAffiliateProgram(input: {
  acceptTerms: boolean;
}): Promise<ActionResult & { code?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!input.acceptTerms) return { ok: false, error: "terms_required" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { affiliateCode: true, affiliateJoinedAt: true },
  });
  if (user?.affiliateJoinedAt && user.affiliateCode) {
    return { ok: true, code: user.affiliateCode };
  }

  // Wiederbeitritt nach Kündigung: bestehenden Code reaktivieren
  if (user?.affiliateCode) {
    await db.user.update({
      where: { id: session.user.id },
      data: { affiliateJoinedAt: new Date() },
    });
    revalidatePath("/[locale]/affiliate", "page");
    return { ok: true, code: user.affiliateCode };
  }

  // Kollisions-sicher: bei (extrem unwahrscheinlichem) Duplikat neu würfeln
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomBytes(8).toString("hex");
    try {
      await db.user.update({
        where: { id: session.user.id },
        data: { affiliateCode: code, affiliateJoinedAt: new Date() },
      });
      revalidatePath("/[locale]/affiliate", "page");
      return { ok: true, code };
    } catch {
      // unique-Konflikt → nächster Versuch
    }
  }
  return { ok: false, error: "generic" };
}

/**
 * Beendet die Partnerschaft: Links und API verlieren sofort ihre Wirkung,
 * bereits verdiente Provisionen bleiben erhalten (auch die in der Sperrfrist).
 * Der Code bleibt reserviert – bei Wiederbeitritt gilt derselbe Link wieder.
 */
export async function leaveAffiliateProgram(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  await db.user.update({
    where: { id: session.user.id },
    data: { affiliateJoinedAt: null },
  });

  revalidatePath("/[locale]/affiliate", "page");
  return { ok: true };
}
