import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isStripeEnabled, stripe } from "@/lib/stripe";
import { fulfillCartCheckout } from "@/lib/fulfillment";
import { CartView } from "@/components/cart/CartView";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const session = await auth();

  // Rückkehr von Stripe: Sitzung verifizieren und Kurse freischalten
  // (idempotent – der Webhook kann dasselbe bereits erledigt haben)
  let purchased = false;
  if (session_id && isStripeEnabled()) {
    try {
      const checkout = await stripe().checkout.sessions.retrieve(session_id);
      if (checkout.metadata?.kind === "cart") {
        await fulfillCartCheckout(checkout);
        purchased = checkout.payment_status === "paid";
      }
    } catch {
      // ungültige Session-ID → normale Warenkorb-Ansicht
    }
  }

  // bereits gekaufte Kurse werden im Warenkorb als solche markiert/entfernt
  const enrolledIds = session?.user?.id
    ? (
        await db.enrollment.findMany({
          where: { userId: session.user.id },
          select: { courseId: true },
        })
      ).map((enrollment) => enrollment.courseId)
    : [];

  return (
    <CartView
      loggedIn={Boolean(session?.user?.id)}
      enrolledCourseIds={enrolledIds}
      purchased={purchased}
    />
  );
}
