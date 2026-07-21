import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { API_CORS_HEADERS, authenticateApiRequest } from "@/lib/api-auth";
import { courseLanguages } from "@elearning/core/course-i18n";
import { loadRatingStats, NO_RATING } from "@/lib/rating-server";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}

/** GET /api/v1/courses – alle veröffentlichten Kurse des Key-Inhabers. */
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status, headers: API_CORS_HEADERS }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // schlankes select: description (Text) wird nie ausgeliefert
  const courses = await db.course.findMany({
    where: { creatorId: authResult.userId, published: true },
    orderBy: { createdAt: "desc" },
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

  return NextResponse.json(
    {
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
    },
    { headers: API_CORS_HEADERS }
  );
}
