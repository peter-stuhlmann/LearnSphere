import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { API_CORS_HEADERS, parseBearerApiKey } from "@/lib/api-auth";
import { hashToken } from "@/lib/tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  courseLanguages,
  pickCourseLanguage,
  resolveCourseText,
} from "@elearning/core/course-i18n";
import { loadRatingStats, NO_RATING } from "@/lib/rating-server";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}

/**
 * GET /api/v1/affiliate/courses – der komplette Shop-Katalog für Affiliates.
 * Auth: Bearer-API-Key eines Accounts, der dem Affiliate-Programm beigetreten
 * ist (kein API-Paket nötig). Mit ?affiliate=true tragen alle Kurs-Links den
 * eigenen Affiliate-Code (?aff=…) → 15 % Provision; ohne den Parameter nicht.
 */
export async function GET(request: NextRequest) {
  const plainKey = parseBearerApiKey(request);
  if (!plainKey) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: API_CORS_HEADERS }
    );
  }

  const key = await db.apiKey.findUnique({
    where: { keyHash: hashToken(plainKey) },
    select: {
      id: true,
      revokedAt: true,
      user: { select: { affiliateCode: true, affiliateJoinedAt: true } },
    },
  });
  if (!key || key.revokedAt) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: API_CORS_HEADERS }
    );
  }
  if (!key.user.affiliateJoinedAt || !key.user.affiliateCode) {
    return NextResponse.json(
      { error: "affiliate_membership_required" },
      { status: 403, headers: API_CORS_HEADERS }
    );
  }

  if (!(await checkRateLimit(`affiliate-api:${key.id}`, { limit: 60, windowMs: 60_000 }))) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...API_CORS_HEADERS, "Retry-After": "60" } }
    );
  }

  // Provision nur bei ausdrücklichem Opt-in per Parameter
  const params = request.nextUrl.searchParams;
  const withAffiliate = params.get("affiliate") === "true";
  const affSuffix = withAffiliate ? `?aff=${key.user.affiliateCode}` : "";

  // Pagination wie bei der öffentlichen API (additiv, v1-kompatibel)
  const per = Math.min(48, Math.max(1, Number(params.get("per")) || 12));
  const where = { published: true, listedInShop: true } as const;
  const total = await db.course.count({ where });
  const pages = Math.max(1, Math.ceil(total / per));
  const page = Math.min(Math.max(1, Number(params.get("page")) || 1), pages);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
          pickCourseLanguage(languages, params.get("lang"))
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
          creatorName:
            course.creator.storefrontName ?? course.creator.name ?? "Creator",
          sectionCount: course.sections.length,
          lessonCount: course.sections.reduce(
            (sum, s) => sum + s._count.lessons,
            0
          ),
          averageRating: rating.average,
          reviewCount: rating.count,
          url: `${appUrl}/${course.language}/courses/${course.slug}${affSuffix}`,
          createdAt: course.createdAt.toISOString(),
        };
      }),
      meta: { affiliate: withAffiliate, total, page, pages, per },
    },
    { headers: API_CORS_HEADERS }
  );
}
