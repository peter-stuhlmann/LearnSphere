import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { lookupWorkspaceByHost } from "@/lib/tenant";
import { mintOAuthHandoff } from "@/lib/tenant-oauth";
import { claimBusinessMemberships } from "@/lib/services/business-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rückkehr nach OAuth auf der Hauptdomain: prüft Mitgliedschaft, löst
 * Einladungen ein, erzeugt einen Handoff-Token und schickt den Browser zum
 * Mandanten-Host. Die (auf der Hauptdomain entstandene) Session wird dabei
 * geräumt – Whitelabel-Portale sollen keinen learnsphere.one-Login hinterlassen.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = (url.searchParams.get("host") ?? "").split(":")[0].toLowerCase();
  const locale = url.searchParams.get("locale") === "en" ? "en" : "de";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "/";
  const loginUrl = `https://${host}/${locale}/login`;

  const session = await auth();
  const ws = host ? await lookupWorkspaceByHost(host) : null;

  // Ungültiger Host → zurück zur Hauptseite (kein offener Redirect)
  if (!ws || ws.status !== "ACTIVE") {
    return NextResponse.redirect(appUrl);
  }
  if (!session?.user?.id) {
    return NextResponse.redirect(loginUrl);
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  const email = dbUser?.email?.toLowerCase();
  if (!email) {
    return NextResponse.redirect(loginUrl);
  }

  // Nur eingeladene Team-Mitglieder erhalten Zugang zum Portal.
  const member = await db.businessMember.findFirst({
    where: { email, license: { ownerId: ws.ownerId } },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.redirect(`${loginUrl}?authError=not_invited`);
  }

  // Offene Einladungen einlösen (Konto verknüpfen + einschreiben)
  await claimBusinessMemberships(session.user.id, email);

  // Einmal-Token + Weiterleitung auf den Mandanten-Host
  const token = await mintOAuthHandoff(session.user.id, host);
  const response = NextResponse.redirect(
    `https://${host}/${locale}/oauth-continue?token=${token}`
  );

  // Hauptdomain-Session räumen (host-only Cookie auf learnsphere.one)
  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Secure-portal.session-token"
      : "portal.session-token";
  response.cookies.set(cookieName, "", { path: "/", maxAge: 0 });

  return response;
}
