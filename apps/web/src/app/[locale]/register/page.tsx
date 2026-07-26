import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getRequestWorkspace } from "@/lib/services/workspace-service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("registerTitle") };
}

export default async function RegisterPage() {
  // OAuth auf Mandanten-Hosts läuft über die Hauptdomain (Bridge + Handoff)
  const workspace = await getRequestWorkspace();
  return <RegisterForm viaApex={Boolean(workspace)} />;
}
