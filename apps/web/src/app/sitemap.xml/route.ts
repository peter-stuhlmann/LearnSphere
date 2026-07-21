import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { renderSitemapIndexXml, sitemapIndexEntries } from "@/lib/sitemap";

/**
 * /sitemap.xml – Sitemap-INDEX mit einer Sprach-Sitemap pro Locale
 * (/sitemaps/de.xml, /sitemaps/en.xml, …). Skaliert für weitere Sprachen
 * und zeigt in der Search Console die Abdeckung pro Sprache getrennt.
 */

export const revalidate = 3600;

export function GET() {
  const xml = renderSitemapIndexXml(
    sitemapIndexEntries(getEnv().NEXT_PUBLIC_APP_URL)
  );
  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
