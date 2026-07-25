"use client";

import { useEffect, useRef } from "react";
import {
  addCourseToCart,
  removeCourseFromCart,
  syncCart,
} from "@/app/actions/cart-actions";
import {
  getCartItems,
  isLocalOnlyClear,
  replaceCart,
  subscribeCart,
} from "./cartStore";

/**
 * Hält für eingeloggte Nutzer den localStorage-Korb und den DB-Korb synchron
 * (im Layout gemountet, rendert nichts):
 * 1. Beim Laden wird der lokale Korb in die DB gemergt (Gast-Korb überlebt
 *    den Login) und der validierte DB-Stand zurückgespiegelt – dadurch ist
 *    der Korb geräteübergreifend und Preise/Titel bleiben frisch.
 * 2. Danach wird jede lokale Änderung (Hinzufügen, Entfernen, Leeren nach
 *    Kauf) als Diff an die DB gepusht.
 */
export function CartSync() {
  // eigener replaceCart-Aufruf darf keinen Diff-Push auslösen
  const mirroring = useRef(false);
  // zuletzt mit der DB abgeglichener Stand; null = Merge noch nicht fertig
  const synced = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    void syncCart({
      courseIds: getCartItems().map((item) => item.courseId),
    }).then((result) => {
      if (cancelled || !result.ok || !result.items) return;
      synced.current = new Set(result.items.map((item) => item.courseId));
      mirroring.current = true;
      replaceCart(result.items);
      mirroring.current = false;
    });

    const unsubscribe = subscribeCart(() => {
      if (mirroring.current || synced.current === null) return;
      // Logout leert nur lokal – der DB-Korb bleibt für das nächste Gerät
      if (isLocalOnlyClear()) {
        synced.current = new Set();
        return;
      }
      const currentIds = new Set(
        getCartItems().map((item) => item.courseId)
      );
      for (const courseId of currentIds) {
        if (!synced.current.has(courseId)) {
          void addCourseToCart({ courseId });
        }
      }
      for (const courseId of synced.current) {
        if (!currentIds.has(courseId)) {
          void removeCourseFromCart({ courseId });
        }
      }
      synced.current = currentIds;
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return null;
}
