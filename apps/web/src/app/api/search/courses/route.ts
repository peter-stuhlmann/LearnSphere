import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  courseSearchWhere,
  matchesCourseText,
  SEARCH_MIN_CHARS,
} from "@/lib/course-search";

/**
 * Live-Suche des Headers: Substring-Suche über Titel, Untertitel, Tags und
 * Beschreibung (nur veröffentlichte Shop-Kurse). Beschreibungs-Treffer
 * werden gegen den reinen Text nachverifiziert (HTML-Tags matchen nicht).
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await checkRateLimit(`search:${ip}`, { limit: 60, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < SEARCH_MIN_CHARS) {
    return NextResponse.json({ results: [] });
  }

  const candidates = await db.course.findMany({
    where: {
      published: true,
      listedInShop: true,
      flaggedAt: null,
      ...courseSearchWhere(query),
    },
    select: {
      slug: true,
      title: true,
      subtitle: true,
      tags: true,
      description: true,
      coverImage: true,
      priceCents: true,
      currency: true,
      creator: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 16,
  });

  const results = candidates
    .filter((course) => matchesCourseText(course, query))
    .slice(0, 8)
    .map((course) => ({
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      coverImage: course.coverImage,
      priceCents: course.priceCents,
      currency: course.currency,
      creatorName: course.creator.name ?? "",
    }));

  return NextResponse.json({ results });
}
