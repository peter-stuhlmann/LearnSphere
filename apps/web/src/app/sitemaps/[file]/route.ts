import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  buildSitemap,
  parseBuildTimestamp,
  parseSitemapLocale,
  renderSitemapXml,
} from "@/lib/sitemap";

/**
 * /sitemaps/<locale>.xml – Sprach-Sitemap (vom Index /sitemap.xml verlinkt):
 * statische Seiten + veröffentlichte Shop-Kurse + Creator-Storefronts in
 * dieser Sprache, jeder Eintrag mit der kompletten hreflang-Gruppe.
 * Kurse ohne Shop-Listung bleiben bewusst draußen.
 */

export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const locale = parseSitemapLocale(file);
  if (!locale) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [courses, creators] = await Promise.all([
    db.course.findMany({
      where: { published: true, listedInShop: true, flaggedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({
      where: {
        handle: { not: null },
        courses: { some: { published: true, listedInShop: true } },
      },
      select: { handle: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const xml = renderSitemapXml(
    buildSitemap({
      baseUrl: getEnv().NEXT_PUBLIC_APP_URL,
      locale,
      courses,
      creators: creators.flatMap((c) =>
        c.handle ? [{ handle: c.handle }] : []
      ),
      staticLastModified: parseBuildTimestamp(
        process.env.NEXT_PUBLIC_BUILD_TIMESTAMP
      ),
    })
  );

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
