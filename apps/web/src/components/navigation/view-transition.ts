/**
 * View Transitions für App-Router-Navigationen: Der Browser friert den
 * alten Frame ein, navigiert, und blendet zum neuen Stand über (inkl.
 * Shared-Element-Morph über gleiche view-transition-name). React 19.1
 * exportiert die <ViewTransition>-Komponente noch nicht stabil – daher
 * direkt über die native API, mit Fallback auf normale Navigation.
 */

type DocumentWithVT = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => unknown;
};

/**
 * Zustands-Toggle (ohne Navigation) als View Transition: gleiche DOM-Knoten,
 * der Browser morpht Elemente mit gleichem view-transition-name von der
 * alten zur neuen Lage. `update` muss den DOM synchron ändern (bei React-
 * State: in flushSync wickeln). Die Klasse `vt-toggle` auf <html> schaltet
 * die Seitenwechsel-Animation des Seitenrests ab (nur benannte Gruppen
 * animieren). Fallback: sofort umschalten; `onFinished` läuft immer.
 */
export function withViewTransition(
  update: () => void,
  onFinished?: () => void
): void {
  const doc = document as DocumentWithVT;
  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (!doc.startViewTransition || reduced) {
    update();
    onFinished?.();
    return;
  }
  doc.documentElement.classList.add("vt-toggle");
  const transition = doc.startViewTransition(update) as {
    finished?: Promise<void>;
  } | null;
  const finish = () => {
    doc.documentElement.classList.remove("vt-toggle");
    onFinished?.();
  };
  if (transition?.finished) void transition.finished.finally(finish);
  else finish();
}

/** Auflöser der laufenden Transition – wird beim Routenwechsel bedient. */
let settle: (() => void) | null = null;

/**
 * Sicherheitsnetz: nie länger als so lange auf die neue Route warten. Bewusst
 * kurz – ein langer, eingefrorener Alt-Frame verleitet sonst dazu, die
 * Zurück-Taste zu drücken, während die Vorwärts-Navigation noch läuft (die
 * beiden konkurrieren dann und man landet „woanders"). Mit loading.tsx rendert
 * die neue Route ohnehin sofort, sodass die Transition viel früher auflöst.
 */
const SETTLE_TIMEOUT_MS = 700;

export function navigateWithViewTransition(navigate: () => void): void {
  const doc = document as DocumentWithVT;
  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (!doc.startViewTransition || reduced) {
    navigate();
    return;
  }
  doc.startViewTransition(() => {
    navigate();
    return new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        window.removeEventListener("popstate", onPop);
        settle = null;
        resolve();
      };
      const timer = setTimeout(finish, SETTLE_TIMEOUT_MS);
      // Drückt jemand während des laufenden Übergangs die Zurück-Taste, lösen
      // wir die Transition sofort auf – sonst konkurriert die eingefrorene
      // Vorwärts-Navigation mit dem Zurück und man landet „woanders".
      const onPop = () => finish();
      window.addEventListener("popstate", onPop, { once: true });
      settle = finish;
    });
  });
}

/** Vom Bridge-Effekt aufgerufen, sobald die neue Route gerendert ist. */
export function settleViewTransition(): void {
  settle?.();
  settle = null;
}

/** Stabiler, CSS-taugicher view-transition-name je Kurs. */
export function courseTransitionName(slug: string): string {
  return `vtc-${slug.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
