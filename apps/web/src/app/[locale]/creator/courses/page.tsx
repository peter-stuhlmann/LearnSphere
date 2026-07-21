import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MyCoursesView } from "@/components/dashboard/MyCoursesView";

const PAGE_SIZES = [6, 12, 24, 48];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("myCourses") };
}

export default async function MyCoursesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    per?: string;
  }>;
}) {
  const { locale } = await params;
  const { q, status, page: pageParam, per: perParam } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const query = (q ?? "").trim();
  const statusFilter =
    status === "published" || status === "draft" ? status : "all";
  const perPage = PAGE_SIZES.includes(Number(perParam))
    ? Number(perParam)
    : 12;

  const where: Prisma.CourseWhereInput = {
    creatorId: session!.user.id,
    ...(query ? { title: { contains: query } } : {}),
    ...(statusFilter === "published" ? { published: true } : {}),
    ...(statusFilter === "draft" ? { published: false } : {}),
  };

  const total = await db.course.count({ where });
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pages);

  // schlankes select: nur die Felder, die die Karten brauchen
  const courses = await db.course.findMany({
    where,
    // zuletzt geöffnet zuerst; nie geöffnete Kurse danach (zuletzt bearbeitet)
    orderBy: [
      { lastOpenedAt: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    skip: (page - 1) * perPage,
    take: perPage,
    select: {
      id: true,
      title: true,
      published: true,
      priceCents: true,
      currency: true,
      coverImage: true,
      _count: { select: { enrollments: true } },
    },
  });

  return (
    <MyCoursesView
      filters={{ q: query, status: statusFilter, page, per: perPage }}
      pagination={{ total, pages, pageSizes: PAGE_SIZES }}
      courses={courses.map((c) => ({
        id: c.id,
        title: c.title,
        published: c.published,
        priceCents: c.priceCents,
        currency: c.currency,
        coverImage: c.coverImage,
        enrollments: c._count.enrollments,
      }))}
    />
  );
}
