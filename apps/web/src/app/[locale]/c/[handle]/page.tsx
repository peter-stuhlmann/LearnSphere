import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadRatingStats } from "@/lib/rating-server";
import { parseTags } from "@elearning/core/tags";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveCourseText,
} from "@elearning/core/course-i18n";
import { StorefrontView } from "@/components/catalog/StorefrontView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const user = await db.user.findUnique({
    where: { handle },
    select: { storefrontName: true, name: true },
  });
  return { title: user?.storefrontName ?? user?.name ?? "Storefront" };
}

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}) {
  const { locale, handle } = await params;

  const creator = await db.user.findUnique({
    where: { handle },
    select: {
      id: true,
      name: true,
      storefrontName: true,
      brandColor: true,
      image: true,
      creatorBio: true,
    },
  });
  if (!creator) notFound();

  // Storefront zeigt alle veröffentlichten Kurse – auch die,
  // die nicht im LearnSphere-Shop gelistet sind.
  const courses = await db.course.findMany({
    where: { creatorId: creator!.id, published: true },
    orderBy: { createdAt: "desc" },
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
      coverImage: true,
      category: true,
      tags: true,
      sections: { select: { _count: { select: { lessons: true } } } },
    },
  });
  const ratings = await loadRatingStats(courses.map((c) => c.id));

  return (
    <StorefrontView
      creator={{
        name: creator!.storefrontName ?? creator!.name ?? "Creator",
        brandColor: creator!.brandColor,
        image: creator!.image,
        bio: creator!.creatorBio ?? "",
      }}
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
          coverImage: c.coverImage,
          category: c.category,
          tags: parseTags(c.tags),
          sectionCount: c.sections.length,
          avgRating: ratings.get(c.id)?.average ?? null,
        };
      })}
    />
  );
}
