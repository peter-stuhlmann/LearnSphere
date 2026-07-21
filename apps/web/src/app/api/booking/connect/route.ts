import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEnv } from "@/lib/env";
import {
  buildConnectAuthorizeUrl,
  createConnectState,
  CONNECT_STATE_COOKIE,
  sanitizeReturnTo,
} from "@/lib/termine-connect";

/**
 * Startet "Mit termine.lol verbinden" für das eingeloggte Konto — aus den
 * Einstellungen oder dem Kurs-Editor (?returnTo= bestimmt den Rücksprung).
 * Signierter state + CSRF-Cookie, dann Redirect zur termine.lol-Consent-
 * Seite. Zurück geht es über ./callback.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const env = getEnv();
  const secret = env.AUTH_SECRET;
  if (!env.TERMINE_CLIENT_ID || !env.TERMINE_CLIENT_SECRET || !secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const locale = params.get("locale") === "en" ? "en" : "de";
  const returnTo = sanitizeReturnTo(
    params.get("returnTo"),
    `/${locale}/settings`
  );

  const state = createConnectState(
    { userId: session.user.id, locale, returnTo },
    secret
  );

  const response = NextResponse.redirect(
    buildConnectAuthorizeUrl({
      locale,
      clientId: env.TERMINE_CLIENT_ID,
      redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/booking/connect/callback`,
      state,
    })
  );
  // Bindet den state zusätzlich an diesen Browser (CSRF-Schutz im Callback)
  response.cookies.set(CONNECT_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/booking/connect",
  });
  return response;
}
