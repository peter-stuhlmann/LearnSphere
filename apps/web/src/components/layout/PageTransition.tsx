"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";

/**
 * Sanfter Seitenübergang für ALLE Browser (bewusst ohne View Transition
 * API – die fehlt in Firefox, und der Übergang soll überall identisch
 * sein): Beim Klick auf einen internen Link blendet der Seiteninhalt aus
 * und eine schmale Ladeleiste erscheint; sobald die neue Route gerendert
 * ist, blendet der Inhalt ein. Header/Footer bleiben unangetastet.
 */

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
`;

const Fader = styled.div<{ $leaving: boolean }>`
  animation: ${fadeIn} 240ms ease-out;

  ${({ $leaving }) =>
    $leaving
      ? css`
          opacity: 0.25;
          transition: opacity 200ms ease-in;
          pointer-events: none;
        `
      : ""}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }
`;

const slide = keyframes`
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(250%);
  }
`;

/* Schmale, unbestimmte Ladeleiste unter dem sticky Header */
const LoadingBar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 90;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.accentSoft};

  &::after {
    content: "";
    display: block;
    width: 40%;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(
      90deg,
      ${({ theme }) => theme.colors.violet},
      ${({ theme }) => theme.colors.accent}
    );
    animation: ${slide} 900ms ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
      width: 100%;
    }
  }
`;

/** interner Link, der wirklich die Route wechselt? */
function isRouteChangeClick(event: MouseEvent): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor || anchor.hasAttribute("download")) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.origin !== window.location.origin) return false;
  // TransitionLink: Übergang läuft über die View Transition API – hier
  // nichts dimmen. Ohne Browser-Support greift weiter dieser Fallback.
  if (
    anchor.hasAttribute("data-view-transition") &&
    "startViewTransition" in document &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return false;
  }
  // gleiche Seite (nur Hash/Query) → kein Übergang
  return anchor.pathname !== window.location.pathname;
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [leaving, setLeaving] = useState(false);
  const [showBar, setShowBar] = useState(false);

  /* Ankunft der neuen Route: Zustand während des Renders angleichen
     (offizielles React-Muster statt setState im Effect) */
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setLeaving(false);
    setShowBar(false);
  }

  // Abgang erkennen: interne Link-Klicks + Vor/Zurück-Navigation.
  // Capture-Phase, denn Next ruft für Client-Navigation selbst
  // preventDefault() auf – danach wäre der Klick nicht mehr erkennbar.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isRouteChangeClick(event)) setLeaving(true);
    };
    const onPopState = () => setLeaving(true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // Ladeleiste erst nach kurzer Verzögerung (schnelle Wechsel flackern
  // sonst); Sicherheitsnetz: hängt eine Navigation (z. B. vom
  // UnsavedChangesGuard abgebrochen), alles wieder freigeben
  useEffect(() => {
    if (!leaving) return;
    const barTimer = window.setTimeout(() => setShowBar(true), 250);
    const safetyTimer = window.setTimeout(() => {
      setLeaving(false);
      setShowBar(false);
    }, 6000);
    return () => {
      window.clearTimeout(barTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [leaving]);

  return (
    <>
      {showBar ? (
        <LoadingBar role="progressbar" aria-label={tc("loading")} />
      ) : null}
      <Fader key={pathname} $leaving={leaving}>
        {children}
      </Fader>
    </>
  );
}
