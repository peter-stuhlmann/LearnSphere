import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isStripeEnabled, stripe } from "@/lib/stripe";
import { fulfillCartCheckout } from "@/lib/fulfillment";
import { getRecommendedCourses } from "@/lib/recommended-courses";
import { CartView } from "@/components/cart/CartView";

export default async function CartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { locale } = await params;
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

  // Einschreibungen (gekaufte Kurse fliegen aus dem Korb) und Empfehlungen
  // (für den leeren Korb; ob er leer ist, weiß nur der Client) parallel laden
  const [enrolledIds, recommendations] = await Promise.all([
    session?.user?.id
      ? db.enrollment
          .findMany({
            where: { userId: session.user.id },
            select: { courseId: true },
          })
          .then((rows) => rows.map((enrollment) => enrollment.courseId))
      : [],
    // nach erfolgreichem Kauf zeigt die Seite keine Empfehlungen
    purchased
      ? []
      : getRecommendedCourses(locale, {
          excludeEnrolledUserId: session?.user?.id,
        }),
  ]);

  return (
    <CartView
      loggedIn={Boolean(session?.user?.id)}
      enrolledCourseIds={enrolledIds}
      purchased={purchased}
      recommendations={recommendations}
    />
  );
}
