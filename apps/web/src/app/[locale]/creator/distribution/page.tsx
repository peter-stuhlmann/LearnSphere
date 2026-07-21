import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DistributionView } from "@/components/dashboard/DistributionView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "distribution" });
  return { title: t("title") };
}

export default async function DistributionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ connected?: string; api?: string }>;
}) {
  const { locale } = await params;
  const { connected, api } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const [user, courses, apiKeys] = await Promise.all([
    db.user.findUnique({
      where: { id: session!.user.id },
      select: {
        name: true,
        handle: true,
        storefrontName: true,
        brandColor: true,
        customDomain: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
      },
    }),
    db.course.findMany({
      where: { creatorId: session!.user.id, published: true },
      select: { slug: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.apiKey.findMany({
      where: { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    }),
  ]);

  const { isStripeEnabled } = await import("@/lib/stripe");
  const { loadPayoutSummary } = await import("@/lib/payout-server");
  const { isApiPlanUsable } = await import("@/lib/api-auth");
  const [payout, apiSubscription, refundRows] = await Promise.all([
    loadPayoutSummary(session!.user.id),
    db.apiSubscription.findUnique({
      where: { userId: session!.user.id },
      select: { status: true, stripeCustomerId: true },
    }),
    // Rückgaben (30-Tage-Garantie): sofort in den Finanzen sichtbar
    db.refund.findMany({
      where: { creatorId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        courseTitle: true,
        amountCents: true,
        creatorShareCents: true,
        reason: true,
        createdAt: true,
      },
    }),
  ]);
  const refundTotals = await db.refund.aggregate({
    where: { creatorId: session!.user.id },
    _count: true,
    _sum: { creatorShareCents: true },
  });

  return (
    <DistributionView
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
      payout={payout}
      refunds={{
        count: refundTotals._count,
        lostShareCents: refundTotals._sum.creatorShareCents ?? 0,
        recent: refundRows.map((refund) => ({
          id: refund.id,
          courseTitle: refund.courseTitle,
          amountCents: refund.amountCents,
          creatorShareCents: refund.creatorShareCents,
          reason: refund.reason,
          createdAt: refund.createdAt.toISOString(),
        })),
      }}
      apiPlan={{
        usable: isApiPlanUsable(apiSubscription?.status),
        pastDue: apiSubscription?.status === "PAST_DUE",
        hasStripeCustomer: Boolean(apiSubscription?.stripeCustomerId),
        justActivated: api === "1",
      }}
      connect={{
        stripeEnabled: isStripeEnabled(),
        hasAccount: Boolean(user?.stripeAccountId),
        chargesEnabled: user?.stripeChargesEnabled ?? false,
        justReturned: connected === "1",
      }}
      storefront={{
        handle: user?.handle ?? "",
        storefrontName: user?.storefrontName ?? user?.name ?? "",
        brandColor: user?.brandColor ?? "",
        customDomain: user?.customDomain ?? "",
      }}
      courses={courses}
      apiKeys={apiKeys.map((key) => ({
        ...key,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        revoked: key.revokedAt !== null,
      }))}
    />
  );
}
