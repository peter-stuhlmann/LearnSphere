import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import {
  AFFILIATE_COOKIE,
  AFFILIATE_WINDOW_DAYS,
  isValidAffiliateCode,
} from "@elearning/core/affiliate";
import { appHostname, lookupWorkspaceByHost } from "@/lib/tenant";

const intl = createIntlMiddleware(routing);

/**
 * Bereichs-Wurzeln (lokalisierte erste Pfad-Segmente), die auf einem
 * Whitelabel-Mandanten-Host NICHT erreichbar sein dürfen: Das Portal ist
 * reiner Lernbereich – Creator/Business/Partner/Admin bleiben aus, und nichts
 * darf die Herkunft LearnSphere verraten (z. B. fremde Storefronts unter /c).
 */
const TENANT_BLOCKED_AREAS = new Set([
  "creator",
  "business",
  "affiliate",
  "partnerprogramm",
  "admin",
  "c",
  "for-creators",
  "fuer-creator",
  "api-docs",
  "api-doku",
  "pricing",
  "preise",
  "roadmap",
]);

/** Erstes inhaltliches Segment nach dem optionalen Locale-Präfix. */
function areaSegment(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const locales = routing.locales as readonly string[];
  return locales.includes(parts[0] ?? "") ? parts[1] : parts[0];
}

/** Whitelabel: eigene Domains werden auf die Creator-Storefront gemappt. */
const domainCache = new Map<
  string,
  { handle: string | null; expires: number }
>();

async function whitelabelHandle(host: string): Promise<string | null> {
  const cached = domainCache.get(host);
  if (cached && cached.expires > Date.now()) {
    return cached.handle;
  }
  let handle: string | null = null;
  try {
    const { db } = await import("@/lib/db");
    const user = await db.user.findUnique({
      where: { customDomain: host },
      select: { handle: true },
    });
    handle = user?.handle ?? null;
  } catch {
    handle = null;
  }
  domainCache.set(host, { handle, expires: Date.now() + 60_000 });
  return handle;
}

export default async function proxy(request: NextRequest) {
  const host =
    request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";

  if (host && host !== appHostname() && host !== "localhost") {
    // 1) Business-Whitelabel-Mandant? (Subdomain oder verifizierte Kundendomain)
    const workspace = await lookupWorkspaceByHost(host);
    if (workspace) {
      // Suspendierte Mandanten sind komplett offline
      if (workspace.status !== "ACTIVE") {
        return new NextResponse(null, { status: 404 });
      }
      // Reiner Lernbereich: gesperrte Bereichs-Wurzeln → 404
      const area = areaSegment(request.nextUrl.pathname);
      if (area && TENANT_BLOCKED_AREAS.has(area)) {
        return new NextResponse(null, { status: 404 });
      }
      // Sonst normal weiter (intl-Routing). Branding/scoped Katalog lesen die
      // Server-Components selbst aus dem Host (lookupWorkspaceByHost, gecacht).
      return intl(request);
    }

    // 2) Sonst: bestehende Creator-Storefront-Whitelabel-Logik
    const handle = await whitelabelHandle(host);
    if (handle && request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = `/${routing.defaultLocale}/c/${handle}`;
      return NextResponse.rewrite(url);
    }
  }

  const response = intl(request);

  // Affiliate-Attribution: ?aff=CODE → httpOnly-Cookie, 7 Tage,
  // letzter Klick gewinnt. Gilt für jeden Kauf innerhalb des Fensters.
  const aff = request.nextUrl.searchParams.get("aff");
  if (aff && isValidAffiliateCode(aff)) {
    response.cookies.set(AFFILIATE_COOKIE, aff, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: AFFILIATE_WINDOW_DAYS * 24 * 60 * 60,
      path: "/",
    });
  }

  return response;
}

export const config = {
  // Alles außer API-Routen, Embeds, Uploads, Next-Interna und statischen Dateien
  matcher: "/((?!api|trpc|embed|uploads|_next|_vercel|.*\\..*).*)",
};
