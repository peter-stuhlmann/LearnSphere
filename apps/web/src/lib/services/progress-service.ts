import { Prisma } from "@prisma/client";
import { lessonWatchRatio } from "@elearning/core/progress";
import { mergePositions } from "@elearning/core/media-position";
import { db } from "@/lib/db";
import { recordLearnActivity } from "@/lib/services/activity-service";

/**
 * Fortschritts-Orchestrierung, geteilt zwischen Server Actions (Web) und
 * Mobile-REST-Routen. Nimmt userId als Parameter, kennt kein auth().
 */

/** Lektion gilt ab 90 % Sehanteil als vollständig gesehen. */
export const LESSON_COMPLETE_RATIO = 0.9;

export type ServiceResult = { ok: true } | { ok: false; error: string };

/** Zuletzt geöffnete Lektion an der Einschreibung vermerken. */
export async function markLessonVisited(
  userId: string,
  lessonId: string
): Promise<ServiceResult> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, section: { select: { courseId: true } } },
  });
  if (!lesson) return { ok: false, error: "not_found" };

  // updateMany statt update: ohne Einschreibung ist es schlicht ein No-Op
  await db.enrollment.updateMany({
    where: { userId, courseId: lesson.section.courseId },
    data: { lastLessonId: lesson.id, lastVisitedAt: new Date() },
  });
  await recordLearnActivity(userId);

  return { ok: true };
}

export async function updateLessonProgress(
  userId: string,
  input: {
    lessonId: string;
    watchedSeconds: number;
    forceComplete?: boolean;
    /** letzte Abspielposition je Medienblock (neuer Stand gewinnt) */
    positions?: Record<string, number>;
  }
): Promise<ServiceResult> {
  const lesson = await db.lesson.findUnique({
    where: { id: input.lessonId },
    include: { section: { select: { courseId: true } } },
  });
  if (!lesson) return { ok: false, error: "not_found" };

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId: lesson.section.courseId },
    },
  });
  if (!enrollment) return { ok: false, error: "not_enrolled" };

  const existing = await db.lessonProgress.findUnique({
    where: {
      enrollmentId_lessonId: {
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
      },
    },
  });

  // Fortschritt kann nur wachsen
  const watched = Math.max(
    existing?.watchedSeconds ?? 0,
    Math.max(0, Math.floor(input.watchedSeconds))
  );
  const completed =
    existing?.completed === true ||
    input.forceComplete === true ||
    lessonWatchRatio(watched, lesson.durationSeconds) >= LESSON_COMPLETE_RATIO;

  // Abspielpositionen: letzter Stand je Block, mit dem Bestand zusammenführen
  const positions = input.positions
    ? mergePositions(existing?.positions, input.positions)
    : undefined;

  await db.lessonProgress.upsert({
    where: {
      enrollmentId_lessonId: {
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
      },
    },
    create: {
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
      watchedSeconds: watched,
      completed,
      ...(positions ? { positions } : {}),
    },
    update: {
      watchedSeconds: watched,
      completed,
      ...(positions ? { positions } : {}),
    },
  });

  return { ok: true };
}

/** "Erledigt" abwählen: Sehstand und Abspielpositionen verwerfen. */
export async function resetLessonProgress(
  userId: string,
  lessonId: string
): Promise<ServiceResult> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { select: { courseId: true } } },
  });
  if (!lesson) return { ok: false, error: "not_found" };

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId: lesson.section.courseId },
    },
  });
  if (!enrollment) return { ok: false, error: "not_enrolled" };

  await db.lessonProgress.updateMany({
    where: { enrollmentId: enrollment.id, lessonId },
    // Neustart der Lektion: auch die Abspielpositionen verwerfen
    data: { watchedSeconds: 0, completed: false, positions: Prisma.DbNull },
  });

  return { ok: true };
}
