"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Nie benachrichtigen – wir unterscheiden nur Server (false) / Client (true). */
function subscribeNever() {
  return () => {};
}

/**
 * Rendert Kinder per Portal direkt in <body>. Nötig für fixed-Overlays
 * (Modals), deren Vorfahren sonst einen eigenen Containing Block bilden –
 * z. B. der sticky Header mit backdrop-filter: dort "klebt" ein
 * position: fixed-Overlay am Header statt im Viewport zu zentrieren.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  if (!mounted) return null;
  return createPortal(children, document.body);
}
