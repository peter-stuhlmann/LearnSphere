import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Gemeinsames Stück der Headless-Lern-Endpoints: Der Integrator
 * identifiziert seine Nutzer:innen per E-Mail; wir lösen daraus das
 * LearnSphere-Konto auf – aber nur, wenn die Person in einem Kurs DES
 * KEY-INHABERS eingeschrieben ist. Ohne diese Kopplung könnte ein
 * Creator mit fremden E-Mails in fremden Kursen agieren.
 */

export const emailSchema = z
  .email()
  .max(191)
  .transform((value) => value.toLowerCase());

export type BuyerResult =
  | { ok: true; userId: string }
  | { ok: false; error: "email_invalid" | "not_enrolled" };

/** E-Mail → Konto, eingeschrieben in einem bestimmten Kurs des Key-Inhabers. */
export async function resolveEnrolledBuyer(
  rawEmail: string | null,
  courseId: string,
  creatorId: string
): Promise<BuyerResult> {
  const parsed = emailSchema.safeParse(rawEmail ?? "");
  if (!parsed.success) return { ok: false, error: "email_invalid" };

  const user = await db.user.findUnique({
    where: { email: parsed.data },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "not_enrolled" };

  const enrollment = await db.enrollment.findFirst({
    where: { userId: user.id, courseId, course: { creatorId } },
    select: { id: true },
  });
  if (!enrollment) return { ok: false, error: "not_enrolled" };

  return { ok: true, userId: user.id };
}
