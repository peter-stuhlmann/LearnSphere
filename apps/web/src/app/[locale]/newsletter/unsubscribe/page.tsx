import { getTranslations } from "next-intl/server";
import { unsubscribeNewsletter } from "@/app/actions/newsletter-actions";
import { NewsletterResult } from "@/components/newsletter/NewsletterResult";

export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await unsubscribeNewsletter(token ?? "");
  const t = await getTranslations("newsletter");

  return (
    <NewsletterResult
      ok={result.ok}
      title={result.ok ? t("unsubscribedTitle") : t("linkInvalidTitle")}
      text={result.ok ? t("unsubscribedText") : t("linkInvalidText")}
    />
  );
}
