import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { API_CORS_HEADERS } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseTags } from "@elearning/core/tags";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveCourseText,
} from "@elearning/core/course-i18n";
import { loadRatingStats, NO_RATING } from "@/lib/rating-server";

const PAGE_SIZE_MAX = 48;
const PAGE_SIZE_DEFAULT = 12;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}

/**
 * GET /api/public/v1/courses – öffentlicher Katalog, kein API-Key nötig.
 * Liefert ausschließlich Kurse, die auf LearnSphere gelistet sind
 * (veröffentlicht + im Shop sichtbar) und nur öffentliche Metadaten.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await checkRateLimit(`public-api:${ip}`, { limit: 60, windowMs: 60_000 }))) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: API_CORS_HEADERS }
    );
  }

  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").trim();
  /** ?lang=en → Texte in dieser Sprache (Fallback: Basissprache des Kurses) */
  const langParam = (params.get("lang") ?? "").trim() || null;
  const per = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number(params.get("per")) || PAGE_SIZE_DEFAULT)
  );

  const where: Prisma.CourseWhereInput = {
    published: true,
    listedInShop: true,
    ...(query
      ? {
          OR: [
            { title: { contains: query } },
            { subtitle: { contains: query } },
          ],
        }
      : {}),
  };

  const total = await db.course.count({ where });
  const pages = Math.max(1, Math.ceil(total / per));
  const page = Math.min(Math.max(1, Number(params.get("page")) || 1), pages);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // schlankes select: description (Text) wird nie ausgeliefert
  const courses = await db.course.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * per,
    take: per,
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
      createdAt: true,
      creator: { select: { name: true, storefrontName: true } },
      sections: { select: { _count: { select: { lessons: true } } } },
    },
  });
  const ratings = await loadRatingStats(courses.map((c) => c.id));

  return NextResponse.json(
    {
      data: courses.map((course) => {
        const rating = ratings.get(course.id) ?? NO_RATING;
        const languages = courseLanguages(course);
        const texts = resolveCourseText(
          course,
          pickCourseLanguage(languages, langParam)
        );
        return {
          id: course.id,
          slug: course.slug,
          title: texts.title,
          subtitle: texts.subtitle,
          language: course.language,
          languages,
          priceCents: course.priceCents,
          currency: course.currency,
          category: course.category,
          tags: parseTags(course.tags),
          creatorName:
            course.creator.storefrontName ?? course.creator.name ?? "Creator",
          sectionCount: course.sections.length,
          lessonCount: course.sections.reduce(
            (sum, s) => sum + s._count.lessons,
            0
          ),
          averageRating: rating.average,
          reviewCount: rating.count,
          url: `${appUrl}/${course.language}/courses/${course.slug}`,
          createdAt: course.createdAt.toISOString(),
        };
      }),
      meta: { total, page, pages, per },
    },
    {
      headers: {
        ...API_CORS_HEADERS,
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
