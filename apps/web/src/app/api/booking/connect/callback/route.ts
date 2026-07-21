import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  CONNECT_STATE_COOKIE,
  parseConnectTokenResponse,
  TERMINE_TOKEN_URL,
  verifyConnectState,
} from "@/lib/termine-connect";

/**
 * Rückweg des termine.lol-Connect-Flows: state prüfen (Signatur + Cookie),
 * Einmal-Code serverseitig gegen Kalender-ID + API-Key tauschen und am
 * Creator-Konto speichern. Zurück geht es dorthin, wo der Flow gestartet
 * wurde (Einstellungen oder Kurs-Editor); das Ergebnis steht im
 * ?termine=-Parameter (connected | denied | error).
 */
export async function GET(request: NextRequest) {
  const env = getEnv();
  const params = request.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  const cookieState = request.cookies.get(CONNECT_STATE_COOKIE)?.value;

  const payload =
    state && cookieState === state && env.AUTH_SECRET
      ? verifyConnectState(state, env.AUTH_SECRET)
      : null;

  // Ohne gültigen state kennen wir kein Rücksprungziel → Einstellungen
  const backTo = `${env.NEXT_PUBLIC_APP_URL}${payload?.returnTo ?? "/de/settings"}`;

  const redirectWith = (result: string) => {
    const response = NextResponse.redirect(`${backTo}?termine=${result}`);
    response.cookies.delete(CONNECT_STATE_COOKIE);
    return response;
  };

  if (!payload) return redirectWith("error");
  if (params.get("error")) return redirectWith("denied");

  const code = params.get("code");
  if (!code) return redirectWith("error");

  // Nur das Konto, das den Flow gestartet hat, darf ihn abschließen
  const session = await auth();
  if (!session?.user?.id || session.user.id !== payload.userId) {
    return redirectWith("error");
  }

  let tokenResult;
  try {
    const upstream = await fetch(TERMINE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: env.TERMINE_CLIENT_ID,
        clientSecret: env.TERMINE_CLIENT_SECRET,
        code,
      }),
    });
    tokenResult = parseConnectTokenResponse(
      await upstream.json().catch(() => null)
    );
  } catch {
    tokenResult = null;
  }
  if (!tokenResult) return redirectWith("error");

  await db.user.update({
    where: { id: payload.userId },
    data: {
      bookingCalendarId: tokenResult.calendarId,
      bookingApiKey: tokenResult.apiKey,
    },
  });

  return redirectWith("connected");
}
