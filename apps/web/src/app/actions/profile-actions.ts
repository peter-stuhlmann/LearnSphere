"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAllowedAvatar, MAX_STORED_AVATAR_BYTES } from "@elearning/core/avatar";
import { isModerationEnabled, moderateImages } from "@/lib/moderation";
import { sanitizeRichText } from "@/lib/sanitize";
import { billingAddressSchema, profileSchema } from "@elearning/core/validation";
import type { ActionResult } from "./auth-actions";

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function updateProfileName(input: {
  name: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  await db.user.update({
    where: { id: userId },
    data: { name: parsed.data.name },
  });

  revalidatePath("/[locale]/profile", "page");
  return { ok: true };
}

export async function saveCreatorBio(input: {
  html: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  if (input.html.length > 50_000) {
    return { ok: false, error: "bio_too_long" };
  }

  await db.user.update({
    where: { id: userId },
    data: { creatorBio: input.html ? sanitizeRichText(input.html) : null },
  });

  revalidatePath("/[locale]/profile", "page");
  return { ok: true };
}

export async function updateAvatar(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return { ok: false, error: "avatar_missing" };
  }
  // Der Client verkleinert vor dem Upload; der Deckel hält das Seiten-HTML
  // klein, in dem der Avatar als Data-URL steckt.
  if (
    !isAllowedAvatar(file.type, file.size) ||
    file.size > MAX_STORED_AVATAR_BYTES
  ) {
    return { ok: false, error: "avatar_invalid" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

  // Inhaltsprüfung (FSK-18/Hass) – abgelehnte Avatare werden nicht gespeichert
  if (isModerationEnabled()) {
    const verdict = await moderateImages([dataUrl]);
    if (verdict.flagged) {
      return { ok: false, error: "avatar_flagged" };
    }
  }

  await db.user.update({
    where: { id: userId },
    data: { image: dataUrl },
  });

  revalidatePath("/[locale]/profile", "page");
  return { ok: true };
}

export async function removeAvatar(): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  await db.user.update({
    where: { id: userId },
    data: { image: null },
  });

  revalidatePath("/[locale]/profile", "page");
  return { ok: true };
}

export async function saveBillingAddress(
  input: unknown
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const parsed = billingAddressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const data = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    street: parsed.data.street,
    addressExtra: parsed.data.addressExtra || null,
    zip: parsed.data.zip,
    city: parsed.data.city,
    country: parsed.data.country,
    email: parsed.data.email,
  };

  await db.billingAddress.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  revalidatePath("/[locale]/profile", "page");
  return { ok: true };
}
