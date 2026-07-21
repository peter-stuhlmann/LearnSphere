import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  lessonFunnel,
  quizPassStats,
  retentionCurve,
} from "@elearning/core/course-analytics";
import { HEAT_BUCKETS } from "@elearning/core/heatmap";
import { loadRatingStats, NO_RATING } from "@/lib/rating-server";
import { CourseStatsView } from "@/components/dashboard/CourseStatsView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "courseStats" });
  return { title: t("title") };
}

export default async function CourseStatsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const course = await db.course.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              blocks: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  type: true,
                  title: true,
                  durationSeconds: true,
                },
              },
            },
          },
          quiz: { select: { id: true, title: true } },
        },
      },
      quizzes: {
        where: { kind: "FINAL" },
        select: { id: true, title: true },
      },
    },
  });
  if (!course || course.creatorId !== session!.user.id) notFound();

  const lessons = course.sections.flatMap((s) => s.lessons);
  const mediaBlocks = lessons.flatMap((lesson) =>
    lesson.blocks
      .filter((b) => b.type === "VIDEO" || b.type === "AUDIO")
      .map((b) => ({ ...b, lessonTitle: lesson.title }))
  );

  // Alle Aggregationsquellen sind unabhängig → parallel laden
  const [enrollments, progressRows, attempts, watchBuckets, ratings] =
    await Promise.all([
      db.enrollment.findMany({
        where: { courseId: course.id },
        select: {
          id: true,
          createdAt: true,
          creatorShareCents: true,
          completedAt: true,
          certificate: { select: { id: true } },
        },
      }),
      db.lessonProgress.findMany({
        where: { enrollment: { courseId: course.id } },
        select: { lessonId: true, watchedSeconds: true, completed: true },
      }),
      db.quizAttempt.findMany({
        where: { quiz: { courseId: course.id } },
        select: {
          quizId: true,
          enrollmentId: true,
          scorePercent: true,
          passed: true,
        },
      }),
      mediaBlocks.length > 0
        ? db.blockWatchBucket.findMany({
            where: { blockId: { in: mediaBlocks.map((b) => b.id) } },
            select: { blockId: true, bucket: true, views: true },
          })
        : [],
      loadRatingStats([course.id]),
    ]);

  const funnel = lessonFunnel(
    lessons.map((lesson) => ({ lessonId: lesson.id, title: lesson.title })),
    progressRows,
    enrollments.length
  );

  const quizzes = [
    ...course.sections
      .filter((s) => s.quiz)
      .map((s) => ({ id: s.quiz!.id, title: s.quiz!.title, kind: "SECTION" })),
    ...course.quizzes.map((q) => ({ id: q.id, title: q.title, kind: "FINAL" })),
  ];
  const quizStats = quizPassStats(
    quizzes.map((q) => q.id),
    attempts
  );

  const retention = mediaBlocks.map((block) => ({
    blockId: block.id,
    title: block.title || block.lessonTitle,
    lessonTitle: block.lessonTitle,
    durationSeconds: block.durationSeconds,
    curve: retentionCurve(
      watchBuckets.filter((row) => row.blockId === block.id),
      HEAT_BUCKETS
    ),
  }));

  const rating = ratings.get(course.id) ?? NO_RATING;

  return (
    <CourseStatsView
      course={{ id: course.id, title: course.title }}
      kpis={{
        enrollments: enrollments.length,
        revenueCents: enrollments.reduce(
          (sum, e) => sum + e.creatorShareCents,
          0
        ),
        completed: enrollments.filter((e) => e.completedAt).length,
        certificates: enrollments.filter((e) => e.certificate).length,
        ratingAverage: rating.average,
        ratingCount: rating.count,
      }}
      funnel={funnel}
      quizzes={quizzes.map((quiz, index) => ({
        ...quiz,
        stats: quizStats[index],
      }))}
      retention={retention}
    />
  );
}
