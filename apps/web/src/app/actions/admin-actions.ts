"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "./auth-actions";

/** Nur der Superadmin (Rolle ADMIN) darf diese Actions ausführen. */
async function requireAdmin(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  return user?.role === "ADMIN" ? { id: user.id } : null;
}

/**
 * Manuelle Prüfung eines geflaggten Uploads: freigeben oder endgültig
 * sperren. Beim Sperren werden Kurse, die das Medium enthalten, sofort
 * auf Entwurf zurückgesetzt (das Publish-Gate verhindert Re-Publish).
 */
export async function reviewMedia(input: {
  id: string;
  approve: boolean;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  const entry = await db.mediaModeration.update({
    where: { id: input.id },
    data: {
      status: input.approve ? "APPROVED" : "REJECTED",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    },
  });

  if (!input.approve) {
    const blocks = await db.lessonBlock.findMany({
      where: { OR: [{ url: entry.url }, { poster: entry.url }] },
      select: { lesson: { select: { section: { select: { courseId: true } } } } },
    });
    const courseIds = [
      ...new Set(blocks.map((b) => b.lesson.section.courseId)),
    ];
    if (courseIds.length > 0) {
      await db.course.updateMany({
        where: { id: { in: courseIds }, published: true },
        data: { published: false },
      });
    }
  }

  revalidatePath("/[locale]/admin/moderation", "page");
  return { ok: true };
}

/**
 * Auszahlung als überwiesen markieren (manuelle IBAN-Überweisung erledigt).
 */
export async function markPayoutPaid(input: {
  payoutId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  const updated = await db.payout.updateMany({
    where: { id: input.payoutId, status: "REQUESTED" },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (updated.count === 0) return { ok: false, error: "not_found" };

  revalidatePath("/[locale]/admin/payouts", "page");
  return { ok: true };
}

/**
 * Offene Auszahlung erneut automatisch per Stripe-Connect-Transfer
 * versuchen (z. B. nachdem der Creator sein Konto verbunden hat).
 */
export async function retryPayoutTransfer(input: {
  payoutId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  const { attemptAutoTransfer } = await import("@/lib/payout-server");
  const transferred = await attemptAutoTransfer(input.payoutId);
  if (!transferred) return { ok: false, error: "transfer_failed" };

  revalidatePath("/[locale]/admin/payouts", "page");
  return { ok: true };
}

/** Kurs sperren (Flag + sofort offline) oder wieder freigeben. */
export async function setCourseFlag(input: {
  courseId: string;
  flagged: boolean;
  reason?: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  await db.course.update({
    where: { id: input.courseId },
    data: input.flagged
      ? {
          flaggedAt: new Date(),
          flagReason: (input.reason ?? "").trim().slice(0, 500) || null,
          published: false,
        }
      : { flaggedAt: null, flagReason: null },
  });

  revalidatePath("/[locale]/admin/courses", "page");
  return { ok: true };
}
