import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isCourseCategory } from "@elearning/core/categories";
import { parseTags } from "@elearning/core/tags";
import { courseSearchWhere } from "@/lib/course-search";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveCourseText,
} from "@elearning/core/course-i18n";
import { CatalogView } from "@/components/catalog/CatalogView";

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
  }>;
}) {
  const { locale } = await params;
  const { q, page: pageParam, per: perParam, cat } = await searchParams;

  const query = (q ?? "").trim();
  const perPage = PAGE_SIZES.includes(Number(perParam))
    ? Number(perParam)
    : 12;

  // Mehrfach-Filter nach Kategorie: ?cat=design,marketing (nur bekannte IDs)
  const categories = (cat ?? "")
    .split(",")
    .filter((id) => isCourseCategory(id));

  const where: Prisma.CourseWhereInput = {
    published: true,
    listedInShop: true,
    ...(categories.length > 0 ? { category: { in: categories } } : {}),
    // inkl. Beschreibung (Substring, case-insensitiv) – gleiche Logik wie
    // die Header-Suche
    ...(query ? courseSearchWhere(query) : {}),
  };

  // Kategorien-Angebot und Trefferzahl sind unabhängig → parallel laden
  const [categoryGroups, total] = await Promise.all([
    db.course.groupBy({
      by: ["category"],
      where: { published: true, listedInShop: true, category: { not: null } },
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
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
    select: {
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
      sections: { select: { _count: { select: { lessons: true } } } },
    },
  });

  return (
    <CatalogView
      filters={{ q: query, page, per: perPage, categories }}
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
        sectionCount: c.sections.length,
        lessonCount: c.sections.reduce((sum, s) => sum + s._count.lessons, 0),
        category: c.category,
        tags: parseTags(c.tags),
        coverImage: c.coverImage,
        };
      })}
    />
  );
}
