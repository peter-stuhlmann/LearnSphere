"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isStripeEnabled, stripe } from "@/lib/stripe";
import { validateSeatCount } from "@elearning/core/business";
import * as service from "@/lib/services/business-service";
import type { BusinessCourseOption } from "@/lib/services/business-service";
import type { ActionResult } from "./auth-actions";

/** LearnSphere Business: Lizenzen und Seat-Verwaltung (nur Inhaber). */

async function requireBusinessUser(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

function refresh() {
  revalidatePath("/[locale]/business", "page");
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Einmal-Bestellung: mit Stripe als Einmalzahlung (payment), ohne Stripe im
 * Demo-Modus direkt angelegt – in Produktion ist der Demo-Weg gesperrt.
 */
export async function startBusinessCheckout(input: {
  courseId: string;
  seats: number;
  locale: string;
}): Promise<ActionResult & { url?: string; demo?: boolean }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "unauthorized" };

  const seats = Number(input.seats);
  const courseId = typeof input.courseId === "string" ? input.courseId : "";
  if (!validateSeatCount(seats)) return { ok: false, error: "seats_invalid" };

  // Rabattierten Seat-Preis aus Kurspreis + Seat-Zahl ableiten und einfrieren.
  const seatPriceCents = await service.courseSeatPriceCents(courseId, seats);
  if (seatPriceCents === null) {
    return { ok: false, error: "course_unavailable" };
  }

  // Superadmin testet ohne Zahlung: Lizenz direkt als Comp (0 €) anlegen.
  if (session.user.role === "ADMIN") {
    const result = await service.createLicense(userId, {
      courseId,
      seats,
      seatPriceCents: 0,
    });
    if (!result.ok) return { ok: false, error: result.error };
    refresh();
    return { ok: true, demo: true };
  }

  if (!isStripeEnabled()) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "payments_unavailable" };
    }
    const result = await service.createLicense(userId, {
      courseId,
      seats,
      seatPriceCents,
    });
    if (!result.ok) return { ok: false, error: result.error };
    refresh();
    return { ok: true, demo: true };
  }

  const locale = input.locale === "en" ? "en" : "de";
  // Einmalzahlung: quantity = Seats × rabattierter Seat-Preis.
  const checkout = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: session?.user?.email ?? undefined,
    line_items: [
      {
        quantity: seats,
        price_data: {
          currency: "eur",
          unit_amount: seatPriceCents,
          product_data: {
            name: `LearnSphere Business – ${seats} Zertifizierungs-Seats`,
          },
        },
      },
    ],
    metadata: {
      kind: "business_license",
      userId,
      courseId,
      seats: String(seats),
      seatPriceCents: String(seatPriceCents),
    },
    success_url: `${appUrl()}/${locale}/business?bl=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/${locale}/business`,
  });
  return { ok: true, url: checkout.url ?? undefined };
}

/** Bestellung widerrufen: Zugänge der Mitglieder enden (keine Rückerstattung). */
export async function cancelBusinessLicense(input: {
  licenseId: string;
}): Promise<ActionResult> {
  const userId = await requireBusinessUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  const result = await service.cancelLicense(
    userId,
    typeof input.licenseId === "string" ? input.licenseId : ""
  );
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true };
}

export async function addBusinessMember(input: {
  licenseId: string;
  email: string;
  /** Einladung per E-Mail verschicken (sonst still anlegen) */
  notify: boolean;
  locale: string;
}): Promise<ActionResult> {
  const userId = await requireBusinessUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  const result = await service.addMember(
    userId,
    typeof input.licenseId === "string" ? input.licenseId : "",
    typeof input.email === "string" ? input.email : "",
    {
      notify: input.notify === true,
      locale: input.locale === "en" ? "en" : "de",
    }
  );
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true };
}

export async function removeBusinessMember(input: {
  memberId: string;
}): Promise<ActionResult> {
  const userId = await requireBusinessUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  const result = await service.removeMember(
    userId,
    typeof input.memberId === "string" ? input.memberId : ""
  );
  if (!result.ok) return { ok: false, error: result.error };
  refresh();
  return { ok: true };
}

export async function searchBusinessCourses(input: {
  query: string;
}): Promise<ActionResult & { courses?: BusinessCourseOption[] }> {
  const userId = await requireBusinessUser();
  if (!userId) return { ok: false, error: "unauthorized" };
  const courses = await service.searchBusinessCourses(
    userId,
    typeof input.query === "string" ? input.query.trim().slice(0, 100) : ""
  );
  return { ok: true, courses };
}
