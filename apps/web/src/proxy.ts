import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import {
  AFFILIATE_COOKIE,
  AFFILIATE_WINDOW_DAYS,
  isValidAffiliateCode,
} from "@elearning/core/affiliate";

const intl = createIntlMiddleware(routing);

/** Whitelabel: eigene Domains werden auf die Creator-Storefront gemappt. */
const domainCache = new Map<
  string,
  { handle: string | null; expires: number }
>();

function appHostname(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
      .hostname;
  } catch {
    return "localhost";
  }
}

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
