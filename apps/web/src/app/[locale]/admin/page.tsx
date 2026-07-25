import { db } from "@/lib/db";
import { businessRevenueSplitCents } from "@elearning/core/business";
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
    businessLicenses,
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
    db.businessLicense.findMany({
      where: { status: { not: "CANCELED" } },
      select: {
        seats: true,
        seatPriceCents: true,
        ownerId: true,
        course: { select: { creatorId: true } },
      },
    }),
  ]);

  // Business-Einnahmen getrennt von Kurskäufen: einmaliger Gesamtumsatz plus
  // der Anteil, der nach Split tatsächlich bei LearnSphere verbleibt.
  let businessRevenueCents = 0;
  let businessLearnsphereCents = 0;
  for (const license of businessLicenses) {
    const total = license.seatPriceCents * license.seats;
    businessRevenueCents += total;
    businessLearnsphereCents += businessRevenueSplitCents({
      totalCents: total,
      creatorIsOwner: license.ownerId === license.course.creatorId,
      hasAffiliate: false,
    }).learnsphereCents;
  }

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
        businessLicenseCount: businessLicenses.length,
        businessSeatCount: businessLicenses.reduce(
          (sum, license) => sum + license.seats,
          0
        ),
        businessRevenueCents,
        businessLearnsphereCents,
      }}
    />
  );
}
