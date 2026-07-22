"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/tokens";
import { storefrontSchema } from "@elearning/core/validation";
import type { ActionResult } from "./auth-actions";

export async function saveStorefront(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const parsed = storefrontSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const [handleOwner, domainOwner] = await Promise.all([
    db.user.findUnique({ where: { handle: parsed.data.handle } }),
    parsed.data.customDomain
      ? db.user.findUnique({
          where: { customDomain: parsed.data.customDomain },
        })
      : null,
  ]);
  if (handleOwner && handleOwner.id !== session.user.id) {
    return { ok: false, error: "handle_taken" };
  }
  if (domainOwner && domainOwner.id !== session.user.id) {
    return { ok: false, error: "domain_taken" };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      handle: parsed.data.handle,
      storefrontName: parsed.data.storefrontName,
      brandColor: parsed.data.brandColor || null,
      customDomain: parsed.data.customDomain || null,
    },
  });

  revalidatePath("/[locale]/creator/distribution", "page");
  return { ok: true };
}

export async function createApiKey(input: {
  name: string;
}): Promise<ActionResult & { plainKey?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "name_too_short" };

  // Die Creator-API ist kostenpflichtig; Affiliates dürfen ebenfalls Keys
  // erstellen (die Affiliate-API prüft die Mitgliedschaft selbst).
  const { hasApiAccess } = await import("@/lib/api-access");
  const [plan, user] = await Promise.all([
    db.apiSubscription.findUnique({
      where: { userId: session.user.id },
      select: { status: true },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { affiliateJoinedAt: true, role: true },
    }),
  ]);
  if (
    !hasApiAccess({ role: user?.role, status: plan?.status }) &&
    !user?.affiliateJoinedAt
  ) {
    return { ok: false, error: "api_plan_required" };
  }

  const activeKeys = await db.apiKey.count({
    where: { userId: session.user.id, revokedAt: null },
  });
  if (activeKeys >= 5) {
    return { ok: false, error: "key_limit_reached" };
  }

  // Klartext-Schlüssel wird nur einmal zurückgegeben, gespeichert wird der Hash
  const plainKey = `ls_${generateToken()}`;
  await db.apiKey.create({
    data: {
      userId: session.user.id,
      name,
      keyHash: hashToken(plainKey),
      prefix: plainKey.slice(0, 11),
    },
  });

  revalidatePath("/[locale]/creator/distribution", "page");
  return { ok: true, plainKey };
}

export async function revokeApiKey(keyId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const key = await db.apiKey.findUnique({ where: { id: keyId } });
  if (!key || key.userId !== session.user.id) {
    return { ok: false, error: "not_found" };
  }

  await db.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/[locale]/creator/distribution", "page");
  return { ok: true };
}
