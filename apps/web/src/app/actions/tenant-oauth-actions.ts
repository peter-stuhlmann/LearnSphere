"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { lookupWorkspaceByHost } from "@/lib/tenant";

/**
 * OAuth für ein Whitelabel-Portal STARTEN – läuft auf der Hauptdomain, weil
 * dort die redirect_uri der Provider registriert ist. Nach erfolgreicher
 * Anmeldung leitet NextAuth auf die Return-Route, die den Handoff-Token
 * erzeugt und zurück auf den Mandanten-Host schickt.
 */
export async function startTenantOAuth(input: {
  provider: "google" | "linkedin";
  host: string;
  locale: string;
}): Promise<void> {
  const host = input.host.split(":")[0].toLowerCase();
  const ws = await lookupWorkspaceByHost(host);
  if (!ws || ws.status !== "ACTIVE") {
    // Unbekannter/gesperrter Host → keine Weiterleitung nach außen
    redirect("/");
  }
  const locale = input.locale === "en" ? "en" : "de";
  const returnTo = `/api/tenant-oauth/return?host=${encodeURIComponent(
    host
  )}&locale=${locale}`;
  await signIn(input.provider, { redirectTo: returnTo });
}

/**
 * Handoff-Token auf dem Mandanten-Host EINLÖSEN: etabliert per
 * handoff-Credentials-Provider eine host-only Session und leitet ins Portal.
 */
export async function consumeTenantOAuth(input: {
  token: string;
  locale: string;
}): Promise<void> {
  const locale = input.locale === "en" ? "en" : "de";
  await signIn("handoff", { token: input.token, redirectTo: `/${locale}` });
}
