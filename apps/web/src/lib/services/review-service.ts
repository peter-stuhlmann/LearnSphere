import { db } from "@/lib/db";
import { sanitizeRichText } from "@/lib/sanitize";

/** Kurs-Bewertungen (1–5 Sterne + optionaler Text), Web + Mobile. */

export type RatingResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export async function upsertRating(
  userId: string,
  courseId: string,
  rawRating: number
): Promise<RatingResult> {
  const rating = Math.round(rawRating);
  if (rating < 1 || rating > 5) {
    return { ok: false, error: "rating_invalid" };
  }

  // Nur eingeschriebene Lernende dürfen bewerten
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { course: { select: { slug: true } } },
  });
  if (!enrollment) return { ok: false, error: "not_enrolled" };

  await db.review.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { rating },
    create: { userId, courseId, rating },
  });

  return { ok: true, slug: enrollment.course.slug };
}

/**
 * Optionalen Review-Text zur bestehenden Bewertung speichern (jederzeit
 * änderbar; leerer Text entfernt das Review, die Sterne bleiben).
 */
export async function saveComment(
  userId: string,
  courseId: string,
  rawComment: string
): Promise<RatingResult> {
  /* Rich-Text serverseitig auf die Allowlist reduzieren; Länge am reinen
     Text messen, damit Formatierung nicht aufs Zeichenlimit zählt */
  const sanitized = sanitizeRichText(rawComment).trim();
  const plainText = sanitized.replace(/<[^>]*>/g, "").trim();
  if (plainText.length > 2000 || sanitized.length > 10_000) {
    return { ok: false, error: "comment_too_long" };
  }
  const comment = plainText ? sanitized : "";

  const review = await db.review.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { course: { select: { slug: true } } },
  });
  // Text nur zusammen mit einer Sterne-Bewertung
  if (!review) return { ok: false, error: "rating_required" };

  await db.review.update({
    where: { id: review.id },
    data: { comment: comment || null },
  });

  return { ok: true, slug: review.course.slug };
}

/** Eigene Bewertung eines Kurses (für die App-Anzeige). */
export async function getOwnReview(
  userId: string,
  courseId: string
): Promise<{ rating: number; comment: string | null } | null> {
  const review = await db.review.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { rating: true, comment: true },
  });
  return review;
}
