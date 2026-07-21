"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { couponSchema } from "@elearning/core/validation";
import type { ActionResult } from "./auth-actions";

function revalidateCouponPages(courseIds: string[]) {
  for (const courseId of courseIds) {
    revalidatePath(`/[locale]/creator/courses/${courseId}/coupons`, "page");
  }
}

export async function createCoupon(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  // Alle gewählten Kurse müssen dem Creator gehören und kostenpflichtig sein
  const courses = await db.course.findMany({
    where: { id: { in: parsed.data.courseIds }, creatorId: session.user.id },
    select: { id: true, priceCents: true },
  });
  if (courses.length !== parsed.data.courseIds.length) {
    return { ok: false, error: "unauthorized" };
  }
  if (courses.some((c) => c.priceCents === 0)) {
    return { ok: false, error: "course_free" };
  }

  // Fester Endpreis oder Cent-Rabatt muss unter dem günstigsten Kurs liegen
  const minPrice = Math.min(...courses.map((c) => c.priceCents));
  if (parsed.data.kind === "FIXED_PRICE" && parsed.data.value >= minPrice) {
    return { ok: false, error: "value_above_price" };
  }

  const existing = await db.coupon.findUnique({
    where: {
      creatorId_code: { creatorId: session.user.id, code: parsed.data.code },
    },
  });
  if (existing) {
    return { ok: false, error: "code_taken" };
  }

  await db.coupon.create({
    data: {
      creatorId: session.user.id,
      code: parsed.data.code,
      kind: parsed.data.kind,
      value: parsed.data.value,
      maxRedemptions: parsed.data.maxRedemptions,
      validFrom: parsed.data.validFrom,
      validUntil: parsed.data.validUntil,
      courses: {
        create: parsed.data.courseIds.map((courseId) => ({ courseId })),
      },
    },
  });

  revalidateCouponPages(parsed.data.courseIds);
  return { ok: true };
}

async function requireOwnedCoupon(couponId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const coupon = await db.coupon.findUnique({
    where: { id: couponId },
    include: { courses: { select: { courseId: true } } },
  });
  if (!coupon || coupon.creatorId !== session.user.id) return null;
  return coupon;
}

export async function setCouponActive(
  couponId: string,
  active: boolean
): Promise<ActionResult> {
  const coupon = await requireOwnedCoupon(couponId);
  if (!coupon) return { ok: false, error: "not_found" };

  await db.coupon.update({ where: { id: couponId }, data: { active } });
  revalidateCouponPages(coupon.courses.map((c) => c.courseId));
  return { ok: true };
}

export async function deleteCoupon(couponId: string): Promise<ActionResult> {
  const coupon = await requireOwnedCoupon(couponId);
  if (!coupon) return { ok: false, error: "not_found" };

  await db.coupon.delete({ where: { id: couponId } });
  revalidateCouponPages(coupon.courses.map((c) => c.courseId));
  return { ok: true };
}
