"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "./auth-actions";

/**
 * Einmalige Freischaltung der gesperrten Bereiche (Creator-Studio,
 * LearnSphere Business): AGB akzeptieren → Zeitstempel am Konto.
 * Idempotent – erneutes Freischalten ist ein No-Op.
 */

async function join(
  field: "creatorJoinedAt" | "businessJoinedAt",
  acceptTerms: boolean
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!acceptTerms) return { ok: false, error: "terms_required" };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { [field]: true },
  });
  if (!user?.[field]) {
    await db.user.update({
      where: { id: session.user.id },
      data: { [field]: new Date() },
    });
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function joinCreatorProgram(input: {
  acceptTerms: boolean;
}): Promise<ActionResult> {
  return join("creatorJoinedAt", input.acceptTerms === true);
}

export async function joinBusinessProgram(input: {
  acceptTerms: boolean;
}): Promise<ActionResult> {
  return join("businessJoinedAt", input.acceptTerms === true);
}
