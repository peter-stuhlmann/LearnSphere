import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSitemapContext } from "@/lib/services/sitemap-context";
import {
  buildSitemap,
  parseBuildTimestamp,
  parseSitemapLocale,
  renderSitemapXml,
  SITEMAP_TENANT_PATHS,
} from "@/lib/sitemap";

/**
 * /sitemaps/<locale>.xml – Sprach-Sitemap (vom Index /sitemap.xml verlinkt).
 * Hauptdomain: statische Seiten + Shop-Kurse + Creator-Storefronts.
 * Whitelabel-Mandant: nur die öffentlichen Rechtsseiten des Betreibers auf
 * dessen eigener Domain – das Portal selbst ist privat (noindex/Login-Gate).
 */

// Host-abhängig → nicht statisch cachen.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const locale = parseSitemapLocale(file);
  if (!locale) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { baseUrl, workspace } = await getSitemapContext();
  const staticLastModified = parseBuildTimestamp(
    process.env.NEXT_PUBLIC_BUILD_TIMESTAMP
  );

  // Mandanten-Portal: keine (fremden) Kurse/Creator, nur Rechtsseiten.
  if (workspace) {
    const xml = renderSitemapXml(
      buildSitemap({
        baseUrl,
        locale,
        courses: [],
        creators: [],
        staticPaths: SITEMAP_TENANT_PATHS,
        staticLastModified,
      })
    );
    return new NextResponse(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
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
      baseUrl,
      locale,
      courses,
      creators: creators.flatMap((c) => (c.handle ? [{ handle: c.handle }] : [])),
      staticLastModified,
    })
  );

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
