import { getTranslations } from "next-intl/server";
import { confirmNewsletter } from "@/app/actions/newsletter-actions";
import { NewsletterResult } from "@/components/newsletter/NewsletterResult";

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await confirmNewsletter(token ?? "");
  const t = await getTranslations("newsletter");

  return (
    <NewsletterResult
      ok={result.ok}
      title={result.ok ? t("confirmedTitle") : t("linkInvalidTitle")}
      text={result.ok ? t("confirmedText") : t("linkInvalidText")}
    />
  );
}
