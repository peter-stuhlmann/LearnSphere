import { sectionLockState } from "@elearning/core/drip";
import { db } from "@/lib/db";

/**
 * Drip Content: gemeinsame Sperrprüfung für Web und Mobile-REST.
 * Die Regeln (Zeit-/Prüfungs-Gate) liegen in @elearning/core/drip.
 */

/** Ist dieser Abschnitt für die Einschreibung aktuell noch gesperrt? */
export async function sectionLockedForEnrollment(
  sectionId: string,
  enrollment: { id: string; createdAt: Date }
): Promise<boolean> {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    select: {
      order: true,
      courseId: true,
      dripAfterDays: true,
      dripAfterQuiz: true,
    },
  });
  if (!section) return false;

  let previousQuizPassed: boolean | null = null;
  if (section.dripAfterQuiz) {
    const previous = await db.section.findFirst({
      where: { courseId: section.courseId, order: { lt: section.order } },
      orderBy: { order: "desc" },
      select: { quiz: { select: { id: true } } },
    });
    if (previous?.quiz) {
      const passed = await db.quizAttempt.findFirst({
        where: {
          enrollmentId: enrollment.id,
          quizId: previous.quiz.id,
          passed: true,
        },
        select: { id: true },
      });
      previousQuizPassed = passed !== null;
    }
  }

  return sectionLockState(
    {
      dripAfterDays: section.dripAfterDays,
      dripAfterQuiz: section.dripAfterQuiz,
    },
    {
      enrolledAt: enrollment.createdAt,
      now: new Date(),
      previousQuizPassed,
    }
  ).locked;
}
