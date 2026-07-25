import { getTranslations } from "next-intl/server";
import { unsubscribeByToken } from "@/lib/services/creator-email-service";
import { NewsletterResult } from "@/components/newsletter/NewsletterResult";

/**
 * Abmeldung von Creator-Mails über den signierten Link im Mail-Footer –
 * ohne Login. Token-Prüfung und Speicherung: creator-email-service.
 */
export default async function CreatorEmailUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; c?: string; t?: string }>;
}) {
  const { e, c, t: token } = await searchParams;
  const result = await unsubscribeByToken({
    encodedEmail: e ?? "",
    creatorId: c ?? "",
    token: token ?? "",
  });
  const t = await getTranslations("creatorEmails");

  return (
    <NewsletterResult
      ok={result.ok}
      title={
        result.ok ? t("unsubscribedTitle") : t("unsubscribeInvalidTitle")
      }
      text={
        result.ok
          ? t("unsubscribedText", { creator: result.creatorName })
          : t("unsubscribeInvalidText")
      }
    />
  );
}
