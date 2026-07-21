import type {
  CourseOutline,
  EnrollmentItem,
  LessonDetail,
} from "@elearning/api-contracts/mobile/v1/learning";
import { courseWatchPercent, isEligibleForExam } from "@elearning/core/progress";
import { isGuaranteeActive } from "@elearning/core/refund";
import {
  pickCourseLanguage,
  resolveBlock,
  resolveCourseText,
  courseLanguages,
  translatedText,
} from "@elearning/core/course-i18n";
import { isProtectedVideoUrl } from "@elearning/core/media-url";
import { db } from "@/lib/db";
import { mediaSignSecret, signedMediaUrl } from "@/lib/media-sign";
import { sectionLockedForEnrollment } from "@/lib/services/drip-service";

/**
 * Lese-Services für die Lern-Endpoints der Mobile-App. Die Berechtigungs-
 * prüfung (Einschreibung) passiert hier – signierte Medien-URLs werden nur
 * für berechtigte Nutzer erzeugt.
 */

export async function listEnrollments(
  userId: string,
  lang?: string | null
): Promise<EnrollmentItem[]> {
  const enrollments = await db.enrollment.findMany({
    where: { userId },
    orderBy: [{ lastVisitedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          description: true,
          coverImage: true,
          language: true,
          extraLanguages: true,
          translations: true,
          sections: {
            select: {
              lessons: { select: { id: true, durationSeconds: true } },
            },
          },
        },
      },
      lessonProgress: {
        select: { lessonId: true, watchedSeconds: true, completed: true },
      },
      certificate: { select: { serial: true } },
    },
  });

  return enrollments.map((enrollment) => {
    const course = enrollment.course;
    const lessons = course.sections.flatMap((s) => s.lessons);
    const texts = resolveCourseText(
      course,
      pickCourseLanguage(courseLanguages(course), lang ?? null)
    );
    return {
      courseId: course.id,
      slug: course.slug,
      title: texts.title,
      subtitle: texts.subtitle ?? null,
      coverImage: course.coverImage,
      watchPercent: courseWatchPercent(
        lessons.map((lesson) => ({
          durationSeconds: lesson.durationSeconds,
          watchedSeconds:
            enrollment.lessonProgress.find((p) => p.lessonId === lesson.id)
              ?.watchedSeconds ?? 0,
        }))
      ),
      lessonCount: lessons.length,
      completedLessons: enrollment.lessonProgress.filter((p) => p.completed)
        .length,
      lastLessonId: enrollment.lastLessonId,
      lastVisitedAt: enrollment.lastVisitedAt?.toISOString() ?? null,
      completedAt: enrollment.completedAt?.toISOString() ?? null,
      certificateSerial: enrollment.certificate?.serial ?? null,
    };
  });
}

export type OutlineResult =
  | { ok: true; outline: CourseOutline }
  | { ok: false; error: "not_found" | "not_enrolled" };

export async function getCourseOutline(
  userId: string,
  courseId: string,
  lang?: string | null
): Promise<OutlineResult> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: { orderBy: { order: "asc" } },
          quiz: { select: { id: true, title: true, passPercent: true } },
        },
      },
      quizzes: {
        where: { kind: "FINAL" },
        select: { id: true, title: true, passPercent: true },
      },
    },
  });
  if (!course || !course.published) return { ok: false, error: "not_found" };

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: {
      lessonProgress: true,
      quizAttempts: { select: { quizId: true, passed: true } },
    },
  });
  if (!enrollment) return { ok: false, error: "not_enrolled" };

  const locale = pickCourseLanguage(courseLanguages(course), lang ?? null);
  const texts = resolveCourseText(course, locale);
  const progressFor = (lessonId: string) =>
    enrollment.lessonProgress.find((p) => p.lessonId === lessonId);
  const quizPassed = (quizId: string) =>
    enrollment.quizAttempts.some((a) => a.quizId === quizId && a.passed);

  const lessons = course.sections.flatMap((s) => s.lessons);
  const watchPercent = courseWatchPercent(
    lessons.map((lesson) => ({
      durationSeconds: lesson.durationSeconds,
      watchedSeconds: progressFor(lesson.id)?.watchedSeconds ?? 0,
    }))
  );
  const sectionQuizzesPassed = course.sections
    .filter((s) => s.quiz)
    .map((s) => quizPassed(s.quiz!.id));

  const finalQuiz = course.quizzes[0] ?? null;

  return {
    ok: true,
    outline: {
      course: {
        id: course.id,
        slug: course.slug,
        title: texts.title,
        requiredWatchPercent: course.requiredWatchPercent,
        finalExamRequired: course.finalExamRequired,
        watchPercent,
        lastLessonId: enrollment.lastLessonId,
      },
      sections: course.sections.map((section) => ({
        id: section.id,
        title: translatedText(
          section.translations,
          locale,
          "title",
          section.title
        ),
        lessons: section.lessons.map((lesson) => ({
          id: lesson.id,
          title: translatedText(
            lesson.translations,
            locale,
            "title",
            lesson.title
          ),
          durationSeconds: lesson.durationSeconds,
          isPreview: lesson.isPreview,
          watchedSeconds: progressFor(lesson.id)?.watchedSeconds ?? 0,
          completed: progressFor(lesson.id)?.completed ?? false,
        })),
        quiz: section.quiz
          ? {
              id: section.quiz.id,
              title: section.quiz.title,
              passPercent: section.quiz.passPercent,
              passed: quizPassed(section.quiz.id),
            }
          : null,
      })),
      finalQuiz: finalQuiz
        ? {
            id: finalQuiz.id,
            title: finalQuiz.title,
            passPercent: finalQuiz.passPercent,
            passed: quizPassed(finalQuiz.id),
            eligible:
              // Rückgabegarantie sperrt die Abschlussprüfung (kein Zertifikat
              // im Rückgabefenster) – der Submit-Pfad erzwingt das ebenfalls
              !isGuaranteeActive(enrollment) &&
              isEligibleForExam({
                watchPercent,
                requiredWatchPercent: course.requiredWatchPercent,
                sectionQuizzesPassed,
              }),
          }
        : null,
    },
  };
}

export type LessonResult =
  | { ok: true; detail: LessonDetail }
  | { ok: false; error: "not_found" | "not_enrolled" };

export async function getLessonForUser(
  userId: string,
  lessonId: string,
  lang?: string | null
): Promise<LessonResult> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      blocks: { orderBy: { order: "asc" } },
      section: {
        include: {
          course: {
            select: {
              id: true,
              published: true,
              language: true,
              extraLanguages: true,
            },
          },
          lessons: { orderBy: { order: "asc" }, select: { id: true } },
        },
      },
    },
  });
  if (!lesson || !lesson.section.course.published) {
    return { ok: false, error: "not_found" };
  }

  const course = lesson.section.course;
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    include: {
      lessonProgress: { where: { lessonId }, take: 1 },
    },
  });
  // Vorschau-Lektionen sind ohne Einschreibung ansehbar
  if (!enrollment && !lesson.isPreview) {
    return { ok: false, error: "not_enrolled" };
  }

  // Drip Content: Lektionen gesperrter Abschnitte nicht ausliefern
  if (
    enrollment &&
    (await sectionLockedForEnrollment(lesson.sectionId, enrollment))
  ) {
    return { ok: false, error: "not_found" };
  }

  const locale = pickCourseLanguage(courseLanguages(course), lang ?? null);
  let signSecret: string | null = null;
  try {
    signSecret = mediaSignSecret();
  } catch {
    // ohne Secret bleiben lokale Medien-URLs unsigniert (und damit 403)
  }

  /** Lokale geschützte Medien signieren; alles andere unverändert. */
  const withSignature = (url: string | null): string | null => {
    if (!url || !signSecret) return url;
    return isProtectedVideoUrl(url) ? signedMediaUrl(url, signSecret) : url;
  };

  const progress = enrollment?.lessonProgress[0];
  const siblingIds = lesson.section.lessons.map((l) => l.id);
  const index = siblingIds.indexOf(lesson.id);

  return {
    ok: true,
    detail: {
      lesson: {
        id: lesson.id,
        title: translatedText(
          lesson.translations,
          locale,
          "title",
          lesson.title
        ),
        sectionId: lesson.sectionId,
        courseId: course.id,
        durationSeconds: lesson.durationSeconds,
        isPreview: lesson.isPreview,
      },
      blocks: lesson.blocks.map((block) => {
        const resolved = resolveBlock(block, locale, course.language);
        return {
          id: block.id,
          type: block.type,
          title: resolved.title,
          url: withSignature(resolved.url),
          fileName: resolved.fileName,
          poster: resolved.poster,
          content: resolved.content,
          durationSeconds: resolved.durationSeconds,
          chapters: Array.isArray(block.chapters)
            ? (block.chapters as { t: number; title: string }[])
            : null,
          mediaFallback: resolved.mediaFallback,
          textFallback: resolved.textFallback,
          // Herkunfts-Fußnote (Art. 50 KI-VO) – auch für die App
          provenance: resolved.provenance,
        };
      }),
      progress: {
        watchedSeconds: progress?.watchedSeconds ?? 0,
        completed: progress?.completed ?? false,
        positions:
          progress?.positions && typeof progress.positions === "object"
            ? (progress.positions as Record<string, number>)
            : {},
      },
      neighbors: {
        prevLessonId: index > 0 ? siblingIds[index - 1] : null,
        nextLessonId:
          index >= 0 && index < siblingIds.length - 1
            ? siblingIds[index + 1]
            : null,
      },
    },
  };
}

export type EnrollFreeResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "payment_required" };

/**
 * Gratis-Einschreibung aus der App. Bezahlkurse laufen über IAP –
 * hier wird jeder Preis > 0 mit payment_required abgewiesen.
 */
export async function enrollFree(
  userId: string,
  courseId: string
): Promise<EnrollFreeResult> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, published: true, priceCents: true },
  });
  if (!course || !course.published) return { ok: false, error: "not_found" };

  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (existing) return { ok: true };

  if (course.priceCents > 0) {
    return { ok: false, error: "payment_required" };
  }

  await db.enrollment.create({
    data: { userId, courseId, pricePaidCents: 0, salesChannel: "PLATFORM" },
  });
  return { ok: true };
}
