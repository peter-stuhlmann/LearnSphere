import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { courseWatchPercent } from "@elearning/core/progress";
import { isGuaranteeActive } from "@elearning/core/refund";
import {
  computeStreak,
  utcDayString,
  weekActivity,
} from "@elearning/core/streak";
import { getActivityDays } from "@/lib/services/activity-service";
import { getReviewQueue } from "@/lib/services/flashcard-service";
import { MyLearningView } from "@/components/learn/MyLearningView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("myLearning") };
}

export default async function MyLearningPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  // Einschreibungen, Aktivitätstage (Streak) und fällige Karteikarten
  // sind unabhängig → parallel laden
  const [enrollments, activityDays, reviewQueue] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: session!.user.id },
      // zuletzt genutzt zuerst; noch nie geöffnete Kurse danach (neueste zuerst)
      orderBy: [
        { lastVisitedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      include: {
        // schlank: nur die Felder, die Karte + Fortschrittsrechnung brauchen
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            coverImage: true,
            creator: { select: { name: true } },
            sections: {
              select: {
                lessons: { select: { id: true, durationSeconds: true } },
              },
            },
          },
        },
        lessonProgress: {
          select: { lessonId: true, watchedSeconds: true },
        },
        certificate: { select: { serial: true } },
        quizAttempts: { select: { quizId: true, scorePercent: true } },
        // "Weiter mit …": Titel der zuletzt geöffneten Lektion
        lastLesson: { select: { title: true } },
      },
    }),
    getActivityDays(session!.user.id),
    getReviewQueue(session!.user.id),
  ]);

  const totalWatchedSeconds = enrollments.reduce(
    (sum, e) =>
      sum + e.lessonProgress.reduce((s, p) => s + p.watchedSeconds, 0),
    0
  );
  const allAttempts = enrollments.flatMap((e) => e.quizAttempts);
  const certificateCount = enrollments.filter((e) => e.certificate).length;

  // Begrüßung: Streak + Wochenleiste, "Weiter mit …" (zuletzt besuchter
  // Kurs) und Anzahl fälliger Karteikarten
  const today = utcDayString(new Date());
  const continueEnrollment =
    enrollments.find((e) => e.lastVisitedAt) ?? enrollments[0] ?? null;
  const continuePercent = continueEnrollment
    ? courseWatchPercent(
        continueEnrollment.course.sections
          .flatMap((s) => s.lessons)
          .map((lesson) => ({
            durationSeconds: lesson.durationSeconds,
            watchedSeconds:
              continueEnrollment.lessonProgress.find(
                (p) => p.lessonId === lesson.id
              )?.watchedSeconds ?? 0,
          }))
      )
    : 0;

  return (
    <MyLearningView
      greeting={{
        userName: session!.user.name ?? null,
        streak: computeStreak(activityDays, today),
        week: weekActivity(activityDays, today),
        dueCards: reviewQueue.dueCount,
        continueItem: continueEnrollment
          ? {
              slug: continueEnrollment.course.slug,
              courseTitle: continueEnrollment.course.title,
              lessonTitle: continueEnrollment.lastLesson?.title ?? null,
              coverImage: continueEnrollment.course.coverImage,
              watchPercent: continuePercent,
            }
          : null,
      }}
      stats={{
        totalWatchedSeconds,
        attempts: allAttempts,
        certificateCount,
      }}
      items={enrollments.map((enrollment) => {
        const lessons = enrollment.course.sections.flatMap((s) => s.lessons);
        const percent = courseWatchPercent(
          lessons.map((lesson) => ({
            durationSeconds: lesson.durationSeconds,
            watchedSeconds:
              enrollment.lessonProgress.find((p) => p.lessonId === lesson.id)
                ?.watchedSeconds ?? 0,
          }))
        );
        return {
          slug: enrollment.course.slug,
          courseId: enrollment.course.id,
          title: enrollment.course.title,
          coverImage: enrollment.course.coverImage,
          creatorName: enrollment.course.creator.name ?? "Creator",
          watchPercent: percent,
          certificateSerial: enrollment.certificate?.serial ?? null,
          // 30-Tage-Garantie: Rückgabe-Button + Frist auf der Karte
          refundableUntil: isGuaranteeActive(enrollment)
            ? (enrollment.refundableUntil?.toISOString() ?? null)
            : null,
        };
      })}
    />
  );
}
