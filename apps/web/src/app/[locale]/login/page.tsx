import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("loginTitle") };
}

export default function LoginPage() {
  return (
    // useSearchParams (registered=1-Hinweis) braucht eine Suspense-Grenze
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
