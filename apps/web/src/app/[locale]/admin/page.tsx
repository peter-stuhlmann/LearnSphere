import { db } from "@/lib/db";
import { AdminDashboardView } from "@/components/admin/AdminDashboardView";

export default async function AdminDashboardPage() {
  const [
    userCount,
    creatorCount,
    courseCount,
    publishedCount,
    flaggedCourseCount,
    enrollmentCount,
    revenue,
    flaggedMediaCount,
    pendingMediaCount,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "CREATOR" } }),
    db.course.count(),
    db.course.count({ where: { published: true } }),
    db.course.count({ where: { flaggedAt: { not: null } } }),
    db.enrollment.count(),
    db.enrollment.aggregate({ _sum: { pricePaidCents: true } }),
    db.mediaModeration.count({ where: { status: "FLAGGED" } }),
    db.mediaModeration.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <AdminDashboardView
      stats={{
        userCount,
        creatorCount,
        courseCount,
        publishedCount,
        flaggedCourseCount,
        enrollmentCount,
        revenueCents: revenue._sum.pricePaidCents ?? 0,
        flaggedMediaCount,
        pendingMediaCount,
      }}
    />
  );
}
