import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isStripeEnabled } from "@/lib/stripe";
import { BillingView } from "@/components/billing/BillingView";

/**
 * /billing – Rechnungen (Kurskäufe), Auszahlungs-Quittungen (Creator) und
 * Abo-Verwaltung an einem Ort, erreichbar über das Avatar-Menü.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing" });
  return { title: t("title") };
}

export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  // Käufe, Auszahlungen, Lizenzen und Abo sind unabhängig → parallel laden
  const [enrollments, payouts, apiSubscription, user, businessLicenses] =
    await Promise.all([
    db.enrollment.findMany({
      where: { userId: session!.user.id, pricePaidCents: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        pricePaidCents: true,
        createdAt: true,
        course: { select: { title: true, currency: true } },
      },
    }),
    db.payout.findMany({
      where: { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amountCents: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    db.apiSubscription.findUnique({
      where: { userId: session!.user.id },
      select: { status: true, interval: true, stripeCustomerId: true },
    }),
    db.user.findUnique({
      where: { id: session!.user.id },
      select: { role: true },
    }),
    db.businessLicense.findMany({
      where: { ownerId: session!.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        seats: true,
        seatPriceCents: true,
        status: true,
        createdAt: true,
        course: { select: { title: true } },
      },
    }),
  ]);

  return (
    <BillingView
      invoices={enrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        date: enrollment.createdAt.toISOString(),
        courseTitle: enrollment.course.title,
        amountCents: enrollment.pricePaidCents,
        currency: enrollment.course.currency,
      }))}
      businessLicenses={businessLicenses.map((license) => ({
        id: license.id,
        courseTitle: license.course.title,
        seats: license.seats,
        totalPaidCents: license.seatPriceCents * license.seats,
        active: license.status !== "CANCELED",
        date: license.createdAt.toISOString(),
      }))}
      payouts={payouts.map((payout) => ({
        id: payout.id,
        date: (payout.paidAt ?? payout.createdAt).toISOString(),
        amountCents: payout.amountCents,
        paid: payout.status === "PAID",
      }))}
      subscription={{
        status: apiSubscription?.status ?? null,
        interval: apiSubscription?.interval ?? null,
        hasStripeCustomer: Boolean(apiSubscription?.stripeCustomerId),
        stripeEnabled: isStripeEnabled(),
        complimentary: user?.role === "ADMIN",
      }}
    />
  );
}
