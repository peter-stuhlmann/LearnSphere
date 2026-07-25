"use server";

import { resolveTxt } from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/tokens";
import { DOMAIN_VERIFY_HOST_PREFIX } from "@/lib/services/workspace-service";
import {
  workspaceDomainSchema,
  workspaceSchema,
} from "@elearning/core/validation";
import type { ActionResult } from "./auth-actions";

/** Owner muss Business freigeschaltet haben (businessJoinedAt). */
async function requireBusinessOwner(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { businessJoinedAt: true },
  });
  return user?.businessJoinedAt ? session.user.id : null;
}

/** Portal-Grunddaten anlegen/aktualisieren (Subdomain-Slug + Branding). */
export async function saveWorkspace(input: unknown): Promise<ActionResult> {
  const ownerId = await requireBusinessOwner();
  if (!ownerId) return { ok: false, error: "unauthorized" };

  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const slugOwner = await db.businessWorkspace.findUnique({
    where: { slug: parsed.data.slug },
    select: { ownerId: true },
  });
  if (slugOwner && slugOwner.ownerId !== ownerId) {
    return { ok: false, error: "slug_taken" };
  }

  const data = {
    slug: parsed.data.slug,
    brandName: parsed.data.brandName,
    brandColor: parsed.data.brandColor || null,
    emailFromName: parsed.data.emailFromName || null,
  };
  await db.businessWorkspace.upsert({
    where: { ownerId },
    update: data,
    create: { ownerId, ...data },
  });

  revalidatePath("/[locale]/business", "page");
  return { ok: true };
}

/** Eigene Kundendomain hinterlegen (unverifiziert) + Verify-Token erzeugen. */
export async function setWorkspaceDomain(input: {
  customDomain: string;
}): Promise<ActionResult> {
  const ownerId = await requireBusinessOwner();
  if (!ownerId) return { ok: false, error: "unauthorized" };

  const parsed = workspaceDomainSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const domain = parsed.data.customDomain;

  const workspace = await db.businessWorkspace.findUnique({
    where: { ownerId },
    select: { id: true },
  });
  if (!workspace) return { ok: false, error: "no_workspace" };

  // Domain darf weder von einem anderen Workspace noch als Creator-Storefront
  // (User.customDomain) belegt sein.
  const [otherWorkspace, storefront] = await Promise.all([
    db.businessWorkspace.findUnique({
      where: { customDomain: domain },
      select: { ownerId: true },
    }),
    db.user.findUnique({
      where: { customDomain: domain },
      select: { id: true },
    }),
  ]);
  if (otherWorkspace && otherWorkspace.ownerId !== ownerId) {
    return { ok: false, error: "domain_taken" };
  }
  if (storefront) return { ok: false, error: "domain_taken" };

  await db.businessWorkspace.update({
    where: { ownerId },
    data: {
      customDomain: domain,
      domainVerifyToken: generateToken(),
      domainVerifiedAt: null,
    },
  });

  revalidatePath("/[locale]/business", "page");
  return { ok: true };
}

/** DNS-TXT prüfen und die Domain bei Treffer als verifiziert markieren. */
export async function verifyWorkspaceDomain(): Promise<ActionResult> {
  const ownerId = await requireBusinessOwner();
  if (!ownerId) return { ok: false, error: "unauthorized" };

  const workspace = await db.businessWorkspace.findUnique({
    where: { ownerId },
    select: { customDomain: true, domainVerifyToken: true },
  });
  if (!workspace?.customDomain || !workspace.domainVerifyToken) {
    return { ok: false, error: "no_domain" };
  }

  let records: string[][] = [];
  try {
    records = await resolveTxt(
      `${DOMAIN_VERIFY_HOST_PREFIX}.${workspace.customDomain}`
    );
  } catch {
    return { ok: false, error: "dns_not_found" };
  }
  const values = records.map((chunks) => chunks.join(""));
  if (!values.includes(workspace.domainVerifyToken)) {
    return { ok: false, error: "dns_mismatch" };
  }

  await db.businessWorkspace.update({
    where: { ownerId },
    data: { domainVerifiedAt: new Date() },
  });

  revalidatePath("/[locale]/business", "page");
  return { ok: true };
}

/** Kundendomain wieder entfernen (Portal bleibt über die Subdomain erreichbar). */
export async function removeWorkspaceDomain(): Promise<ActionResult> {
  const ownerId = await requireBusinessOwner();
  if (!ownerId) return { ok: false, error: "unauthorized" };

  await db.businessWorkspace.update({
    where: { ownerId },
    data: { customDomain: null, domainVerifyToken: null, domainVerifiedAt: null },
  });

  revalidatePath("/[locale]/business", "page");
  return { ok: true };
}
