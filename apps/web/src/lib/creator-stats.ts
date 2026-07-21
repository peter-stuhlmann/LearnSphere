import { db } from "@/lib/db";
import {
  completionRate,
  startDateForRange,
  type StatRange,
} from "@elearning/core/stats";
import type { CreatorTotals } from "@/components/dashboard/StatsSummary";

/** Kern-KPIs eines Creators im Zeitraum (Dashboard + Statistikseite). */
export async function loadCreatorTotals(
  userId: string,
  range: StatRange
): Promise<CreatorTotals> {
  const start = startDateForRange(range, new Date());
  const courseFilter = { course: { creatorId: userId } };

  const [enrollments, reviews] = await Promise.all([
    db.enrollment.findMany({
      where: {
        ...courseFilter,
        ...(start ? { createdAt: { gte: start } } : {}),
      },
      select: {
        userId: true,
        creatorShareCents: true,
        completedAt: true,
      },
    }),
    db.review.findMany({
      where: {
        ...courseFilter,
        ...(start ? { createdAt: { gte: start } } : {}),
      },
      select: { rating: true },
    }),
  ]);

  const ratings = reviews.map((r) => r.rating);

  return {
    sales: enrollments.length,
    revenueCents: enrollments.reduce((sum, e) => sum + e.creatorShareCents, 0),
    learners: new Set(enrollments.map((e) => e.userId)).size,
    completion: completionRate(enrollments),
    avgRating:
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10
          ) / 10
        : null,
    reviewCount: ratings.length,
  };
}
