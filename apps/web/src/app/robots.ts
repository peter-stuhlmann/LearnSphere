import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";
import { robotsDisallowPaths } from "@/lib/sitemap";

/** /robots.txt – öffentliche Seiten frei, interne Bereiche gesperrt. */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getEnv().NEXT_PUBLIC_APP_URL;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: robotsDisallowPaths(),
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
