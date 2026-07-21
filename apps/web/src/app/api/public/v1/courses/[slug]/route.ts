import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { API_CORS_HEADERS } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseTags } from "@elearning/core/tags";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveCourseText,
  translatedText,
} from "@elearning/core/course-i18n";
import { loadRatingStats, NO_RATING } from "@/lib/rating-server";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}

/**
 * GET /api/public/v1/courses/[slug] – öffentliches Kursdetail inkl.
 * Curriculum-Metadaten (Titel, Dauer, Vorschau-Flag – keine Inhalte).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await checkRateLimit(`public-api:${ip}`, { limit: 60, windowMs: 60_000 }))) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: API_CORS_HEADERS }
    );
  }

  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      creator: { select: { name: true, storefrontName: true } },
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              title: true,
              translations: true,
              durationSeconds: true,
              isPreview: true,
            },
          },
        },
      },
    },
  });

  // Nur was auch im LearnSphere-Shop öffentlich sichtbar ist
  if (!course || !course.published || !course.listedInShop) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: API_CORS_HEADERS }
    );
  }

  const ratings = await loadRatingStats([course.id]);
  const rating = ratings.get(course.id) ?? NO_RATING;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  /** ?lang=en → Texte in dieser Sprache (Fallback: Basissprache des Kurses) */
  const languages = courseLanguages(course);
  const contentLang = pickCourseLanguage(
    languages,
    request.nextUrl.searchParams.get("lang")
  );
  const texts = resolveCourseText(course, contentLang);

  return NextResponse.json(
    {
      data: {
        id: course.id,
        slug: course.slug,
        title: texts.title,
        subtitle: texts.subtitle,
        description: texts.description,
        language: course.language,
        languages,
        priceCents: course.priceCents,
        currency: course.currency,
        category: course.category,
        tags: parseTags(course.tags),
        creatorName:
          course.creator.storefrontName ?? course.creator.name ?? "Creator",
        averageRating: rating.average,
        reviewCount: rating.count,
        url: `${appUrl}/${course.language}/courses/${course.slug}`,
        sections: course.sections.map((section) => ({
          title: translatedText(
            section.translations,
            contentLang,
            "title",
            section.title
          ),
          lessons: section.lessons.map((lesson) => ({
            title: translatedText(
              lesson.translations,
              contentLang,
              "title",
              lesson.title
            ),
            durationSeconds: lesson.durationSeconds,
            isPreview: lesson.isPreview,
          })),
        })),
      },
    },
    {
      headers: {
        ...API_CORS_HEADERS,
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
