import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getReviewQueue } from "@/lib/services/flashcard-service";
import { ReviewView } from "@/components/learn/ReviewView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "review" });
  return { title: t("title") };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const queue = await getReviewQueue(session!.user.id);

  return (
    <ReviewView
      cards={queue.cards}
      dueCount={queue.dueCount}
      totalCards={queue.totalCards}
      nextDueAt={queue.nextDueAt}
    />
  );
}
