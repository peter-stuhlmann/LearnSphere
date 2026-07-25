import { db } from "@/lib/db";
import type { ServiceResult } from "@/lib/services/progress-service";

/**
 * Lektions-Favoriten: Stern-Markierung des Lernenden in der Lern-Ansicht.
 * Nimmt userId als Parameter, kennt kein auth() (wie progress-service).
 */

/** Stern umschalten; liefert den neuen Zustand zurück. */
export async function toggleLessonFavorite(
  userId: string,
  lessonId: string
): Promise<ServiceResult & { favorite?: boolean }> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, section: { select: { courseId: true } } },
  });
  if (!lesson) return { ok: false, error: "not_found" };

  // Favoriten gibt es nur in belegten Kursen
  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId: lesson.section.courseId },
    },
    select: { id: true },
  });
  if (!enrollment) return { ok: false, error: "not_enrolled" };

  const existing = await db.lessonFavorite.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { id: true },
  });
  if (existing) {
    await db.lessonFavorite.delete({ where: { id: existing.id } });
    return { ok: true, favorite: false };
  }
  await db.lessonFavorite.create({ data: { userId, lessonId } });
  return { ok: true, favorite: true };
}
