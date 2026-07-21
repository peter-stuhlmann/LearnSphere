"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "./auth-actions";

const emailSchema = z.email();

/**
 * Warteliste: E-Mail-Eintragung auf der "Demnächst"-Seite eines noch nicht
 * veröffentlichten Kurses. Doppelte Eintragungen sind idempotent (Upsert),
 * benachrichtigt wird genau einmal bei Veröffentlichung.
 */
export async function joinWaitlist(input: {
  courseId: string;
  email: string;
  locale: string;
}): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input.email.trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "email_invalid" };
  const email = parsed.data;
  const locale = input.locale === "en" ? "en" : "de";

  // gegen Missbrauch: max. 5 Eintragungsversuche pro Adresse und Stunde
  if (
    !(await checkRateLimit(`waitlist:${email}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    }))
  ) {
    return { ok: false, error: "too_many_attempts" };
  }

  const course = await db.course.findUnique({
    where: { id: input.courseId },
    select: { id: true, published: true, waitlistEnabled: true },
  });
  // Nur unveröffentlichte Kurse mit aktiver Warteliste
  if (!course || course.published || !course.waitlistEnabled) {
    return { ok: false, error: "not_found" };
  }

  const session = await auth();
  await db.waitlistEntry.upsert({
    where: { courseId_email: { courseId: course.id, email } },
    create: {
      courseId: course.id,
      email,
      locale,
      userId: session?.user?.id ?? null,
    },
    update: { locale },
  });

  return { ok: true };
}
