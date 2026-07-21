import { db } from "@/lib/db";
import { loadRatingStats } from "@/lib/rating-server";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveCourseText,
} from "@elearning/core/course-i18n";
import { LandingHome } from "@/components/landing/LandingHome";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [courseCount, learnerCount, featuredCourses] = await Promise.all([
    db.course.count({ where: { published: true, listedInShop: true } }),
    db.user.count(),
    // Kurs-Highlights: die meistgebuchten veröffentlichten Shop-Kurse –
    // schlankes select (keine description) + Zähler statt Relationszeilen
    db.course.findMany({
      where: { published: true, listedInShop: true },
      orderBy: { enrollments: { _count: "desc" } },
      take: 3,
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
        creator: { select: { name: true, storefrontName: true } },
        _count: { select: { sections: true } },
      },
    }),
  ]);
  const ratings = await loadRatingStats(featuredCourses.map((c) => c.id));

  return (
    <main id="main">
      <LandingHome
        stats={{ courses: courseCount, learners: learnerCount }}
        featured={featuredCourses.map((course) => {
          const texts = resolveCourseText(
            course,
            pickCourseLanguage(courseLanguages(course), locale)
          );
          return {
          slug: course.slug,
          title: texts.title,
          subtitle: texts.subtitle ?? "",
          creatorName:
            course.creator.storefrontName ?? course.creator.name ?? "Creator",
          priceCents: course.priceCents,
          currency: course.currency,
          sectionCount: course._count.sections,
          avgRating: ratings.get(course.id)?.average ?? null,
          };
        })}
      />
    </main>
  );
}
