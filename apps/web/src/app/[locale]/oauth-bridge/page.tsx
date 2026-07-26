import { redirect } from "@/i18n/navigation";
import { lookupWorkspaceByHost } from "@/lib/tenant";
import { OAuthBridge } from "@/components/auth/OAuthBridge";

export const dynamic = "force-dynamic";

/**
 * Läuft auf der Hauptdomain: nimmt Provider + Ziel-Host entgegen, prüft den
 * Host als aktiven Mandanten und startet dann den OAuth-Flow.
 */
export default async function OAuthBridgePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ provider?: string; host?: string }>;
}) {
  const { locale } = await params;
  const { provider: providerParam, host: hostParam } = await searchParams;
  const provider = providerParam === "linkedin" ? "linkedin" : "google";
  const host = (hostParam ?? "").split(":")[0].toLowerCase();

  const ws = host ? await lookupWorkspaceByHost(host) : null;
  if (!ws || ws.status !== "ACTIVE") {
    redirect({ href: "/", locale });
  }

  return <OAuthBridge provider={provider} host={host} locale={locale} />;
}
