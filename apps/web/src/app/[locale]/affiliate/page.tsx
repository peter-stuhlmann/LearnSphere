import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { loadBalanceCents } from "@/lib/payout-server";
import { AffiliateView } from "@/components/marketing/AffiliateView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "affiliateProgram" });
  return { title: t("kicker"), description: t("lead") };
}

export default async function AffiliatePage() {
  const session = await auth();

  let member: {
    joined: boolean;
    code: string | null;
    earnedCents: number;
    salesCount: number;
    balanceCents: number;
  } | null = null;

  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { affiliateCode: true, affiliateJoinedAt: true },
    });
    if (user?.affiliateJoinedAt && user.affiliateCode) {
      const [earned, balanceCents] = await Promise.all([
        db.enrollment.aggregate({
          where: { affiliateUserId: session.user.id },
          _sum: { affiliateShareCents: true },
          _count: true,
        }),
        loadBalanceCents(session.user.id),
      ]);
      member = {
        joined: true,
        code: user.affiliateCode,
        earnedCents: earned._sum.affiliateShareCents ?? 0,
        salesCount: earned._count,
        balanceCents,
      };
    } else {
      member = {
        joined: false,
        code: null,
        earnedCents: 0,
        salesCount: 0,
        balanceCents: 0,
      };
    }
  }

  return (
    <AffiliateView
      loggedIn={Boolean(session?.user?.id)}
      member={member}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
    />
  );
}
