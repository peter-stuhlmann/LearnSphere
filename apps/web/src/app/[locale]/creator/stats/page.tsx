import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  buildDailySeries,
  completionRate,
  ratingDistribution,
  startDateForRange,
  STAT_RANGES,
  type StatRange,
} from "@elearning/core/stats";
import { HEAT_BUCKETS } from "@elearning/core/heatmap";
import { StatsView } from "@/components/dashboard/StatsView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "stats" });
  return { title: t("title") };
}

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { locale } = await params;
  const { range: rangeParam } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const range: StatRange = STAT_RANGES.includes(rangeParam as StatRange)
    ? (rangeParam as StatRange)
    : "30d";
  const now = new Date();
  const start = startDateForRange(range, now);

  const courses = await db.course.findMany({
    where: { creatorId: session!.user.id },
    select: { id: true, title: true },
  });
  const courseIds = courses.map((c) => c.id);
  const courseTitle = new Map(courses.map((c) => [c.id, c.title]));

  const [enrollments, reviews] = await Promise.all([
    db.enrollment.findMany({
      where: {
        courseId: { in: courseIds },
        ...(start ? { createdAt: { gte: start } } : {}),
      },
      select: {
        courseId: true,
        userId: true,
        pricePaidCents: true,
        creatorShareCents: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    db.review.findMany({
      where: {
        courseId: { in: courseIds },
        ...(start ? { createdAt: { gte: start } } : {}),
      },
      select: { rating: true },
    }),
  ]);

  const seriesStart =
    start ??
    enrollments.reduce(
      (min, e) => (e.createdAt < min ? e.createdAt : min),
      now
    );

  // "Einnahmen" = Anteil des Creators (50 % / 75 % je Kanal), nicht der Bruttopreis
  const revenueSeries = buildDailySeries(
    enrollments.map((e) => ({
      createdAt: e.createdAt,
      value: e.creatorShareCents,
    })),
    seriesStart,
    now
  );
  const salesSeries = buildDailySeries(
    enrollments.map((e) => ({ createdAt: e.createdAt, value: 1 })),
    seriesStart,
    now
  );

  const revenueByCourse = new Map<string, { revenue: number; sales: number }>();
  for (const enrollment of enrollments) {
    const entry = revenueByCourse.get(enrollment.courseId) ?? {
      revenue: 0,
      sales: 0,
    };
    entry.revenue += enrollment.creatorShareCents;
    entry.sales += 1;
    revenueByCourse.set(enrollment.courseId, entry);
  }
  const courseStats = [...revenueByCourse.entries()]
    .map(([courseId, data]) => ({
      title: courseTitle.get(courseId) ?? "–",
      revenueCents: data.revenue,
      sales: data.sales,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 8);

  const ratings = reviews.map((r) => r.rating);
  const avgRating =
    ratings.length > 0
      ? Math.round(
          (ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10
        ) / 10
      : null;

  // Video-Heatmap: Seh-Zähler je Medienblock (welche Stellen werden
  // geschaut/übersprungen?) – Top-Videos nach Datenmenge
  const mediaBlocks = await db.lessonBlock.findMany({
    where: {
      type: { in: ["VIDEO", "AUDIO"] },
      lesson: { section: { courseId: { in: courseIds } } },
    },
    select: {
      id: true,
      title: true,
      type: true,
      lesson: {
        select: {
          title: true,
          section: { select: { courseId: true } },
        },
      },
      watchBuckets: { select: { bucket: true, views: true } },
    },
  });
  const videoHeatmaps = mediaBlocks
    .map((block) => {
      const total = block.watchBuckets.reduce((sum, b) => sum + b.views, 0);
      const max = Math.max(1, ...block.watchBuckets.map((b) => b.views));
      const heat = new Array<number>(HEAT_BUCKETS).fill(0);
      for (const row of block.watchBuckets) {
        if (row.bucket >= 0 && row.bucket < HEAT_BUCKETS) {
          heat[row.bucket] = row.views / max;
        }
      }
      return {
        blockId: block.id,
        label: block.title || block.lesson.title,
        courseTitle:
          courseTitle.get(block.lesson.section.courseId) ?? "–",
        type: block.type,
        total,
        heat,
      };
    })
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return (
    <StatsView
      range={range}
      totals={{
        sales: enrollments.length,
        revenueCents: enrollments.reduce(
          (sum, e) => sum + e.creatorShareCents,
          0
        ),
        learners: new Set(enrollments.map((e) => e.userId)).size,
        completion: completionRate(enrollments),
        avgRating,
        reviewCount: ratings.length,
      }}
      revenueSeries={revenueSeries}
      salesSeries={salesSeries}
      courseStats={courseStats}
      ratingBuckets={ratingDistribution(ratings)}
      videoHeatmaps={videoHeatmaps}
    />
  );
}
