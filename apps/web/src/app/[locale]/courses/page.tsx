import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isCourseCategory } from "@elearning/core/categories";
import { parseTags } from "@elearning/core/tags";
import { courseSearchWhere } from "@/lib/course-search";
import { courseOrderBy, parseCourseSort } from "@/lib/course-sort";
import { loadRatingStats } from "@/lib/rating-server";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveCourseText,
} from "@elearning/core/course-i18n";
import { CatalogView } from "@/components/catalog/CatalogView";
import {
  getRequestWorkspace,
  licensedCourseIds,
  requireTenantAuth,
} from "@/lib/services/workspace-service";

const PAGE_SIZES = [6, 12, 24, 48];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("title") };
}

export default async function CoursesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    per?: string;
    cat?: string;
    free?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  // Mandanten-Portal: Katalog nur für eingeloggte Team-Mitglieder
  await requireTenantAuth(locale);
  const {
    q,
    page: pageParam,
    per: perParam,
    cat,
    free,
    sort: sortParam,
  } = await searchParams;

  const query = (q ?? "").trim();
  const perPage = PAGE_SIZES.includes(Number(perParam))
    ? Number(perParam)
    : 12;
  const freeOnly = free === "1";
  const sort = parseCourseSort(sortParam);

  // Mehrfach-Filter nach Kategorie: ?cat=design,marketing (nur bekannte IDs)
  const categories = (cat ?? "")
    .split(",")
    .filter((id) => isCourseCategory(id));

  // Auf einem Whitelabel-Mandanten-Host zeigt der Katalog ausschließlich die
  // vom Owner lizenzierten Kurse (unabhängig von listedInShop).
  const workspace = await getRequestWorkspace();
  const tenantScope: Prisma.CourseWhereInput = workspace
    ? { id: { in: await licensedCourseIds(workspace.ownerId) } }
    : { listedInShop: true };

  const where: Prisma.CourseWhereInput = {
    published: true,
    ...tenantScope,
    ...(categories.length > 0 ? { category: { in: categories } } : {}),
    ...(freeOnly ? { priceCents: 0 } : {}),
    // inkl. Beschreibung (Substring, case-insensitiv) – gleiche Logik wie
    // die Header-Suche
    ...(query ? courseSearchWhere(query) : {}),
  };

  // Kategorien-Angebot und Trefferzahl sind unabhängig → parallel laden
  const [categoryGroups, total] = await Promise.all([
    db.course.groupBy({
      by: ["category"],
      where: { published: true, ...tenantScope, category: { not: null } },
    }),
    db.course.count({ where }),
  ]);
  const availableCategories = categoryGroups
    .map((g) => g.category)
    .filter((id): id is string => Boolean(id));

  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pages);

  // schlankes select: description (Text) wird auf Karten nie gebraucht
  const courses = await db.course.findMany({
    where,
    orderBy: courseOrderBy(sort),
    skip: (page - 1) * perPage,
    take: perPage,
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      language: true,
      extraLanguages: true,
      translations: true,
      priceCents: true,
      currency: true,
      category: true,
      tags: true,
      coverImage: true,
      creator: { select: { name: true, storefrontName: true } },
      _count: { select: { enrollments: true } },
    },
  });
  const ratings = await loadRatingStats(courses.map((c) => c.id));

  // Bereits belegte Kurse zeigen auf der Karte "Eingeschrieben" statt Preis
  const session = await auth();
  const enrolledIds = new Set(
    session?.user?.id
      ? (
          await db.enrollment.findMany({
            where: {
              userId: session.user.id,
              courseId: { in: courses.map((c) => c.id) },
            },
            select: { courseId: true },
          })
        ).map((e) => e.courseId)
      : []
  );

  return (
    <CatalogView
      filters={{ q: query, page, per: perPage, categories, freeOnly, sort }}
      availableCategories={availableCategories}
      pagination={{ total, pages, pageSizes: PAGE_SIZES }}
      courses={courses.map((c) => {
        const languages = courseLanguages(c);
        const texts = resolveCourseText(
          c,
          pickCourseLanguage(languages, locale)
        );
        return {
        slug: c.slug,
        title: texts.title,
        subtitle: texts.subtitle ?? "",
        languages,
        priceCents: c.priceCents,
        currency: c.currency,
        creatorName: c.creator.storefrontName ?? c.creator.name ?? "Creator",
        enrolledCount: c._count.enrollments,
        avgRating: ratings.get(c.id)?.average ?? null,
        category: c.category,
        tags: parseTags(c.tags),
        coverImage: c.coverImage,
        enrolled: enrolledIds.has(c.id),
        };
      })}
    />
  );
}
