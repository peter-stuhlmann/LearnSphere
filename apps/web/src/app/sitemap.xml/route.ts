import { NextResponse } from "next/server";
import { getSitemapContext } from "@/lib/services/sitemap-context";
import { renderSitemapIndexXml, sitemapIndexEntries } from "@/lib/sitemap";

/**
 * /sitemap.xml – Sitemap-INDEX mit einer Sprach-Sitemap pro Locale
 * (/sitemaps/de.xml, /sitemaps/en.xml, …). Host-abhängig: auf einem
 * Whitelabel-Mandanten mit dessen eigener Domain (kein learnsphere.one-Leak).
 */

// Host-abhängig → nie statisch cachen (sonst könnte ein Host den Cache eines
// anderen bekommen).
export const dynamic = "force-dynamic";

export async function GET() {
  const { baseUrl } = await getSitemapContext();
  const xml = renderSitemapIndexXml(sitemapIndexEntries(baseUrl));
  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
