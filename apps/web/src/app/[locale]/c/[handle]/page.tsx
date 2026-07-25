import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
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
          enrolledCount: c._count.enrollments,
          avgRating: ratings.get(c.id)?.average ?? null,
          enrolled: enrolledIds.has(c.id),
        };
      })}
    />
  );
}
