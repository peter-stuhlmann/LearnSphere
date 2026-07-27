import type { MetadataRoute } from "next";
import { robotsDisallowPaths } from "@/lib/sitemap";
import { getSitemapContext } from "@/lib/services/sitemap-context";

// Host-abhängig (Mandant vs. Hauptdomain) → nicht statisch cachen.
export const dynamic = "force-dynamic";

/** /robots.txt – öffentliche Seiten frei, interne Bereiche gesperrt. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { baseUrl, workspace } = await getSitemapContext();

  // Whitelabel-Portal ist privat (noindex + Login-Gate) → komplett aussperren,
  // und niemals auf die learnsphere.one-Sitemap verweisen.
  if (workspace) {
    return {
      rules: { userAgent: "*", disallow: "/" },
      sitemap: `${baseUrl}/sitemap.xml`,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: robotsDisallowPaths(),
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
