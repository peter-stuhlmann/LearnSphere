"use server";

import { auth } from "@/auth";
import {
  submitFlashcardReview,
  type FlashcardReviewResult,
} from "@/lib/services/flashcard-service";
import type { ActionResult } from "./auth-actions";

/**
 * Spaced Repetition: eine Karteikarte bewerten. Die Terminierung (SM-2)
 * liegt in @elearning/core, die Berechtigungsprüfung im Service.
 */
export async function reviewCard(input: {
  questionId: string;
  grade: "again" | "good" | "easy";
}): Promise<ActionResult | FlashcardReviewResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!["again", "good", "easy"].includes(input.grade)) {
    return { ok: false, error: "invalid" };
  }
  return submitFlashcardReview(
    session.user.id,
    input.questionId,
    input.grade
  );
}
