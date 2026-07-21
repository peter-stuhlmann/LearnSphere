"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { isAnyUnsaved, markUnsaved, subscribeUnsaved } from "@/lib/unsaved";

/**
 * Formulare melden hiermit ihren "dirty"-Zustand an den globalen Guard.
 * Beim Unmount (z. B. nach erfolgreichem Speichern) wird automatisch
 * wieder abgemeldet.
 */
export function useUnsavedMarker(dirty: boolean): void {
  const id = useId();
  useEffect(() => {
    markUnsaved(id, dirty);
    return () => markUnsaved(id, false);
  }, [id, dirty]);
}

const getServerSnapshot = () => false;

/**
 * Warnt beim Verlassen der Seite, solange irgendein Formular ungespeicherte
 * Änderungen gemeldet hat: interne Links bekommen einen hübschen
 * Bestätigungsdialog, Tab schließen/Neuladen/externe Links den nativen
 * Browser-Dialog (beforeunload). Einmal global im Layout gemountet.
 */
export function UnsavedChangesGuard() {
  const t = useTranslations("common");
  // bewusst der rohe Next-Router: die abgefangene URL ist bereits lokalisiert
  const router = useRouter();
  const dirty = useSyncExternalStore(
    subscribeUnsaved,
    isAnyUnsaved,
    getServerSnapshot
  );
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Tab schließen, Neuladen, externe Links
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Interne Links (Client-Navigation) abfangen, bevor Next sie ausführt
  useEffect(() => {
    if (!dirty) return;
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!anchor) return;
      if (
        anchor.getAttribute("target") === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      // Editor-interne Links (z. B. zum Quiz-Editor): kein Dialog – der
      // Entwurf übersteht die Navigation per sessionStorage-Draft
      if (anchor.hasAttribute("data-allow-unsaved")) return;
      const url = new URL(
        anchor.getAttribute("href") ?? "",
        window.location.href
      );
      // extern → deckt der beforeunload-Dialog ab
      if (url.origin !== window.location.origin) return;
      // gleiche Seite (z. B. Sprungmarken) → kein Datenverlust
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  return (
    <ConfirmDialog
      open={pendingHref !== null}
      title={t("unsavedTitle")}
      message={t("unsavedMessage")}
      confirmLabel={t("unsavedLeave")}
      cancelLabel={t("unsavedStay")}
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href) router.push(href);
      }}
      onCancel={() => setPendingHref(null)}
    />
  );
}
