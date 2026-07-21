import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { loadCreatorTotals } from "@/lib/creator-stats";
import { STAT_RANGES, type StatRange } from "@elearning/core/stats";
import { DashboardView } from "@/components/dashboard/DashboardView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("title") };
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { locale } = await params;
  const { range: rangeParam } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const range: StatRange = STAT_RANGES.includes(rangeParam as StatRange)
    ? (rangeParam as StatRange)
    : "30d";

  const totals = await loadCreatorTotals(session!.user.id, range);

  return (
    <DashboardView
      userName={session!.user.name ?? ""}
      statsRange={range}
      statsTotals={totals}
    />
  );
}
