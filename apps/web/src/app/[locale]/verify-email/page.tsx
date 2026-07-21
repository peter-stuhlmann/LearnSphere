import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { confirmEmail } from "@/app/actions/auth-actions";
import { NewsletterResult } from "@/components/newsletter/NewsletterResult";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("verifyTitle"), robots: { index: false } };
}

/** Verifizierungs-Link aus der Registrierungs-Mail einlösen. */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await confirmEmail(token ?? "");
  const t = await getTranslations("auth");

  return (
    <NewsletterResult
      ok={result.ok}
      title={result.ok ? t("verifySuccessTitle") : t("verifyInvalidTitle")}
      text={result.ok ? t("verifySuccessText") : t("verifyInvalidText")}
      action={
        result.ok ? { href: "/login", label: t("loginNow") } : undefined
      }
    />
  );
}
