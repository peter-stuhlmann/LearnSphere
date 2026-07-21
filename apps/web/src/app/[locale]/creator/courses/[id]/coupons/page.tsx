import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CouponsView } from "@/components/dashboard/CouponsView";

export default async function CouponsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const course = await db.course.findUnique({ where: { id } });
  if (!course || course.creatorId !== session!.user.id) {
    notFound();
  }

  // Gutscheine dieses Kurses + alle Bezahlkurse des Creators für die Auswahl
  const [coupons, paidCourses] = await Promise.all([
    db.coupon.findMany({
      where: {
        creatorId: session!.user.id,
        courses: { some: { courseId: id } },
      },
      include: {
        courses: {
          include: { course: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.course.findMany({
      where: { creatorId: session!.user.id, priceCents: { gt: 0 } },
      select: { id: true, title: true, priceCents: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <CouponsView
      courseId={course.id}
      courseTitle={course.title}
      priceCents={course.priceCents}
      currency={course.currency}
      paidCourses={paidCourses}
      coupons={coupons.map((c) => ({
        id: c.id,
        code: c.code,
        kind: c.kind,
        value: c.value,
        maxRedemptions: c.maxRedemptions,
        redeemedCount: c.redeemedCount,
        validFrom: c.validFrom?.toISOString() ?? null,
        validUntil: c.validUntil?.toISOString() ?? null,
        active: c.active,
        courseTitles: c.courses.map((link) => link.course.title),
      }))}
    />
  );
}
