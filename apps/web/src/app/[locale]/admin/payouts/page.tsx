import { db } from "@/lib/db";
import { AdminPayoutsView } from "@/components/admin/AdminPayoutsView";

/**
 * Auszahlungs-Warteschlange: offene Anträge zuerst (manuelle Überweisung
 * oder Stripe-Connect-Retry), danach die zuletzt erledigten.
 */
export default async function AdminPayoutsPage() {
  const payouts = await db.payout.findMany({
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      amountCents: true,
      status: true,
      holder: true,
      iban: true,
      createdAt: true,
      paidAt: true,
      user: {
        select: {
          email: true,
          name: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
        },
      },
    },
  });

  return (
    <AdminPayoutsView
      payouts={payouts.map((payout) => ({
        id: payout.id,
        amountCents: payout.amountCents,
        status: payout.status,
        holder: payout.holder,
        iban: payout.iban,
        createdAt: payout.createdAt.toISOString(),
        paidAt: payout.paidAt?.toISOString() ?? null,
        userEmail: payout.user.email,
        userName: payout.user.name ?? "—",
        connectReady: Boolean(
          payout.user.stripeAccountId && payout.user.stripeChargesEnabled
        ),
      }))}
    />
  );
}
