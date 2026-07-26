import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { getRequestWorkspace } from "@/lib/services/workspace-service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("loginTitle") };
}

export default async function LoginPage() {
  // Auf Whitelabel-Mandanten-Hosts läuft OAuth über die Hauptdomain (Bridge +
  // Handoff), weil die redirect_uri der Provider nur für learnsphere.one gilt.
  const workspace = await getRequestWorkspace();

  return (
    // useSearchParams (registered=1-Hinweis) braucht eine Suspense-Grenze
    <Suspense>
      <LoginForm viaApex={Boolean(workspace)} />
    </Suspense>
  );
}
