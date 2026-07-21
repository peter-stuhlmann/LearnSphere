"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import * as reviewService from "@/lib/services/review-service";
import type { ActionResult } from "./auth-actions";

/** Kurs-Bewertungen. Logik: lib/services/review-service (geteilt mit Mobile). */

export async function rateCourse(input: {
  courseId: string;
  rating: number;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const result = await reviewService.upsertRating(
    session.user.id,
    input.courseId,
    input.rating
  );
  if (!result.ok) return result;

  revalidatePath(`/[locale]/learn/${result.slug}`, "page");
  return { ok: true };
}

/**
 * Optionalen Review-Text zur bestehenden Bewertung speichern (jederzeit
 * änderbar; leerer Text entfernt das Review, die Sterne bleiben).
 */
export async function saveReviewComment(input: {
  courseId: string;
  comment: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const result = await reviewService.saveComment(
    session.user.id,
    input.courseId,
    input.comment
  );
  if (!result.ok) return result;

  revalidatePath(`/[locale]/learn/${result.slug}`, "page");
  return { ok: true };
}
