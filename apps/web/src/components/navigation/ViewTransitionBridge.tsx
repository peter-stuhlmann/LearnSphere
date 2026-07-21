"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { settleViewTransition } from "./view-transition";

/**
 * Schließt laufende View Transitions ab, sobald die neue Route gerendert
 * ist (Pathname-Wechsel nach Commit). Ohne Transition ist das ein No-Op.
 */
export function ViewTransitionBridge() {
  const pathname = usePathname();
  useEffect(() => {
    settleViewTransition();
  }, [pathname]);
  return null;
}
