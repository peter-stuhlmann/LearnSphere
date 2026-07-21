import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { isStripeEnabled, stripe } from "@/lib/stripe";
import {
  fulfillApiSubscriptionCheckout,
  fulfillCartCheckout,
  fulfillCourseCheckout,
  revokeCheckoutEnrollments,
  syncApiSubscription,
} from "@/lib/fulfillment";

/**
 * Erstattung/Chargeback → zugehörige Checkout-Session(s) über den
 * Payment Intent finden und das Fulfillment zurückrollen.
 */
async function revokeByPaymentIntent(
  paymentIntent: string | Stripe.PaymentIntent | null
): Promise<void> {
  const id =
    typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
  if (!id) return;
  const sessions = await stripe().checkout.sessions.list({
    payment_intent: id,
    limit: 5,
  });
  for (const session of sessions.data) {
    await revokeCheckoutEnrollments(session);
  }
}

/**
 * Stripe-Webhook: die verlässliche Quelle für Zahlungs-Fulfillment.
 * Signatur wird geprüft; alle Handler sind idempotent, weil Stripe
 * Events mehrfach zustellen kann.
 */
export async function POST(request: NextRequest) {
  if (!isStripeEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.metadata?.kind === "course") {
        await fulfillCourseCheckout(session);
      } else if (session.metadata?.kind === "cart") {
        await fulfillCartCheckout(session);
      } else if (session.metadata?.kind === "api_subscription") {
        await fulfillApiSubscriptionCheckout(session);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncApiSubscription(event.data.object);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      // Teilerstattungen (Kulanz) lassen den Zugang bestehen – nur die
      // vollständige Erstattung entzieht Kurs, Zertifikat und Anteile
      if (charge.amount_refunded >= charge.amount) {
        await revokeByPaymentIntent(charge.payment_intent);
      }
      break;
    }
    case "charge.dispute.created": {
      // Chargeback: Zugang sofort entziehen, bis der Fall geklärt ist
      await revokeByPaymentIntent(event.data.object.payment_intent);
      break;
    }
    case "account.updated": {
      // Connect-Onboarding abgeschlossen/geändert → Verkaufsstatus spiegeln
      const account = event.data.object;
      await db.user.updateMany({
        where: { stripeAccountId: account.id },
        data: { stripeChargesEnabled: account.charges_enabled === true },
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
