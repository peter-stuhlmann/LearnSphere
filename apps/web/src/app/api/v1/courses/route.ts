import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiRequest, retryAfterHeaders } from "@/lib/api-auth";
import { courseLanguages } from "@elearning/core/course-i18n";
import { loadRatingStats, NO_RATING } from "@/lib/rating-server";

/*
 * Bewusst KEIN CORS/OPTIONS: Die Creator-API gehört auf den Server des
 * Integrators – der API-Key darf nie in Browser-Code stehen.
 */

const PAGE_SIZE_MAX = 100;

/**
 * GET /api/v1/courses – alle veröffentlichten Kurse des Key-Inhabers.
 * Pagination ist additiv: ohne ?page/?per kommt wie bisher alles auf
 * einmal, mit Parametern seitenweise inkl. meta-Block.
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status, headers: retryAfterHeaders(authResult.status) }
    );
  }

  const params = request.nextUrl.searchParams;
  const paginated = params.has("page") || params.has("per");
  const per = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number(params.get("per")) || 25)
  );

  const where = { creatorId: authResult.userId, published: true } as const;
  const total = await db.course.count({ where });
  const pages = Math.max(1, Math.ceil(total / per));
  const page = Math.min(Math.max(1, Number(params.get("page")) || 1), pages);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // schlankes select: description (Text) wird nie ausgeliefert
  const courses = await db.course.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(paginated ? { skip: (page - 1) * per, take: per } : {}),
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      language: true,
      extraLanguages: true,
      priceCents: true,
      currency: true,
      listedInShop: true,
      createdAt: true,
      sections: { select: { _count: { select: { lessons: true } } } },
    },
  });
  const ratings = await loadRatingStats(courses.map((c) => c.id));

  return NextResponse.json({
    data: courses.map((course) => {
      const rating = ratings.get(course.id) ?? NO_RATING;
      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        language: course.language,
        languages: courseLanguages(course),
        priceCents: course.priceCents,
        currency: course.currency,
        listedInShop: course.listedInShop,
        sectionCount: course.sections.length,
        lessonCount: course.sections.reduce(
          (sum, s) => sum + s._count.lessons,
          0
        ),
        averageRating: rating.average,
        reviewCount: rating.count,
        // via=api: Käufe über diesen Link zählen als Drittseiten-Verkauf
        url: `${appUrl}/de/courses/${course.slug}?via=api`,
        embedUrl: `${appUrl}/embed/${course.slug}`,
        createdAt: course.createdAt.toISOString(),
      };
    }),
    ...(paginated ? { meta: { total, page, pages, per } } : {}),
  });
}
