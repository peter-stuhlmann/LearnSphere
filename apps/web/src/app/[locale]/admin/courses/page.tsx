import { db } from "@/lib/db";
import { AdminCoursesView } from "@/components/admin/AdminCoursesView";

const PAGE_SIZES = [20, 50, 100];

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const per = PAGE_SIZES.includes(Number(params.per))
    ? Number(params.per)
    : PAGE_SIZES[0];

  const where = q
    ? {
        OR: [
          { title: { contains: q } },
          { slug: { contains: q } },
          { creator: { email: { contains: q } } },
          { creator: { name: { contains: q } } },
        ],
      }
    : {};

  const total = await db.course.count({ where });
  const pages = Math.max(1, Math.ceil(total / per));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pages);

  const courses = await db.course.findMany({
    where,
    orderBy: [{ flaggedAt: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * per,
    take: per,
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      flaggedAt: true,
      flagReason: true,
      priceCents: true,
      currency: true,
      createdAt: true,
      creator: { select: { email: true, name: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return (
    <AdminCoursesView
      filters={{ q, page, per }}
      pagination={{ total, pages, pageSizes: PAGE_SIZES }}
      courses={courses.map((course) => ({
        id: course.id,
        slug: course.slug,
        title: course.title,
        published: course.published,
        flagged: Boolean(course.flaggedAt),
        flagReason: course.flagReason ?? "",
        priceCents: course.priceCents,
        currency: course.currency,
        createdAt: course.createdAt.toISOString(),
        creator: course.creator.email ?? course.creator.name ?? "?",
        enrollments: course._count.enrollments,
      }))}
    />
  );
}
