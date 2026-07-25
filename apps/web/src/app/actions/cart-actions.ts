"use server";

import { auth } from "@/auth";
import * as cartService from "@/lib/services/cart-service";
import type { CartCourseItem } from "@/lib/services/cart-service";
import type { ActionResult } from "./auth-actions";

/**
 * DB-Warenkorb (eingeloggte Nutzer). Gäste bleiben rein im localStorage –
 * diese Actions werden nur von CartSync bzw. mit Session aufgerufen.
 */

/** localStorage-Korb einmalig zusammenführen; liefert den DB-Stand zurück. */
export async function syncCart(input: {
  courseIds: string[];
}): Promise<ActionResult & { items?: CartCourseItem[] }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (
    !Array.isArray(input.courseIds) ||
    input.courseIds.some((id) => typeof id !== "string" || id.length > 50)
  ) {
    return { ok: false, error: "invalid_request" };
  }
  const items = await cartService.mergeCart(
    session.user.id,
    input.courseIds.slice(0, 100)
  );
  return { ok: true, items };
}

export async function addCourseToCart(input: {
  courseId: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  await cartService.addCourseToCart(session.user.id, input.courseId);
  return { ok: true };
}

export async function removeCourseFromCart(input: {
  courseId: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  await cartService.removeCourseFromCart(session.user.id, input.courseId);
  return { ok: true };
}
