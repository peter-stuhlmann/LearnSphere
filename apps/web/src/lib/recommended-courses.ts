import { db } from "@/lib/db";
import { parseTags } from "@elearning/core/tags";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveCourseText,
} from "@elearning/core/course-i18n";
import { courseOrderBy } from "@/lib/course-sort";
import { loadRatingStats } from "@/lib/rating-server";
import type { CourseCardCourse } from "@/components/catalog/CourseCard";

/**
 * Startempfehlungen für leere Ansichten (Lernbereich ohne Einschreibungen,
 * leerer Warenkorb): die beliebtesten Shop-Kurse, aufbereitet für die
 * gemeinsame Kurs-Karte. Bereits belegte Kurse des Users werden ausgelassen.
 */
export async function getRecommendedCourses(
  locale: string,
  options: { excludeEnrolledUserId?: string; take?: number } = {}
): Promise<CourseCardCourse[]> {
  const { excludeEnrolledUserId, take = 6 } = options;
  const courses = await db.course.findMany({
    where: {
      published: true,
      listedInShop: true,
      ...(excludeEnrolledUserId
        ? { enrollments: { none: { userId: excludeEnrolledUserId } } }
        : {}),
    },
    orderBy: courseOrderBy("popular"),
    take,
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

  return courses.map((c) => {
    const languages = courseLanguages(c);
    const texts = resolveCourseText(c, pickCourseLanguage(languages, locale));
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
    };
  });
}
