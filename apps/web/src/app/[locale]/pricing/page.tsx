import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PricingView } from "@/components/marketing/PricingView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "creatorPricing" });
  return { title: t("title") };
}

export default async function PricingPage() {
  const session = await auth();

  const apiPlan = session?.user?.id
    ? await db.apiSubscription.findUnique({
        where: { userId: session.user.id },
        select: { status: true },
      })
    : null;

  return (
    <PricingView
      isLoggedIn={Boolean(session?.user)}
      apiPlanActive={
        apiPlan?.status === "ACTIVE" || apiPlan?.status === "PAST_DUE"
      }
    />
  );
}
