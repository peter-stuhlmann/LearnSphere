import { OAuthContinue } from "@/components/auth/OAuthContinue";

export const dynamic = "force-dynamic";

/**
 * Läuft auf dem Mandanten-Host: löst den Handoff-Token ein und etabliert die
 * host-only Session (danach Weiterleitung ins Portal).
 */
export default async function OAuthContinuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;

  return <OAuthContinue token={token ?? ""} locale={locale} />;
}
