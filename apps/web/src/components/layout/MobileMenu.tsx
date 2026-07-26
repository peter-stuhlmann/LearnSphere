"use client";

import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import styled from "styled-components";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BodyPortal } from "@/components/ui/BodyPortal";

/**
 * Vollflächiges Mobil-Menü: öffnet sich smooth über den ganzen Viewport, die
 * Einträge faden gestaffelt ein. Fasst Navigation, Bereichswechsel und Konto
 * in einem Overlay zusammen (per Sektionen mit optionaler Überschrift).
 *
 * Barrierefrei als modaler Dialog – Fokus-Falle, Escape/Close, Body-Scroll
 * gesperrt, Fokus kehrt beim Schließen zum auslösenden Element zurück.
 * Respektiert prefers-reduced-motion (dann nur ein dezentes Ein-/Ausblenden).
 */

const Sheet = styled(motion.div)<{ $accent: string }>`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  padding: 1rem 20px calc(2rem + env(safe-area-inset-bottom));
  overflow-y: auto;
  transform-origin: top right;
  background:
    radial-gradient(
      130% 60% at 92% -8%,
      ${({ $accent }) => $accent}22,
      transparent 62%
    ),
    ${({ theme }) => theme.colors.bgDeep};
  backdrop-filter: blur(18px);
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 42px;
  margin-bottom: 1.5rem;
`;

const Kicker = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.68rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/* Aktionen rechts oben: optionaler leading-Slot (z. B. Suche) + Schließen */
const TopActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;

const CloseButton = styled.button<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.text};
  font-size: 1.1rem;
  transition:
    border-color 150ms ease,
    color 150ms ease;

  &:hover {
    border-color: ${({ $accent }) => $accent};
    color: ${({ $accent }) => $accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ $accent }) => $accent};
    outline-offset: 2px;
  }
`;

const Body = styled(motion.div)<{ $accent: string }>`
  display: flex;
  flex-direction: column;

  /* Einträge (Links/Buttons) im Vollbild groß und großzügig – unabhängig von
     ihrem Header-Styling (z. B. NavLink/CtaLink). */
  .m-item {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
  /* kein Doppelstrich direkt unter dem User-Kopf / Sektions-Label */
  .m-item:first-child {
    border-top: none;
  }

  .m-item > a,
  .m-item > button {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.65rem;
    padding: 0.85rem 0.25rem;
    background: transparent;
    border: none;
    border-radius: 0;
    text-align: left;
    text-decoration: none;
    font-size: 1.05rem;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
    transition:
      color 160ms ease,
      padding-left 200ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .m-item > a:hover,
  .m-item > button:hover,
  .m-item > a:focus-visible,
  .m-item > button:focus-visible {
    color: ${({ $accent }) => $accent};
    padding-left: 0.6rem;
    outline: none;
  }

  /* Primär-Aktion (z. B. Registrieren) in Bereichsfarbe hervorheben */
  .m-item > a.cta {
    color: ${({ $accent }) => $accent};
    font-weight: 700;
  }

  /* Destruktiv (Abmelden) rot hervorheben */
  .m-item > button.danger:hover,
  .m-item > button.danger:focus-visible {
    color: ${({ theme }) => theme.colors.danger};
  }
`;

const SectionLabel = styled(motion.p)`
  margin: 1.25rem 0 0.2rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.64rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};

  &:first-child {
    margin-top: 0;
  }
`;

const Item = styled(motion.div).attrs({ className: "m-item" })``;

/* Grid-Sektion: kompakte Buttons nebeneinander (Bereichswechsel) */
const GridBlock = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.35rem;
`;

/* Kopfbereich (z. B. angemeldeter Nutzer) zwischen TopBar und Sektionen */
const MenuHeader = styled.div`
  margin-bottom: 0.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

export type MobileMenuSection = {
  /** Optionale Sektions-Überschrift (mono Kicker) */
  label?: string;
  /** Links/Buttons der Sektion */
  items: ReactNode[];
  /** "list" (default) = gestapelte große Zeilen; "grid" = kompakte Buttons
   *  nebeneinander (z. B. Bereichswechsel) */
  layout?: "list" | "grid";
};

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  /** Sichtbarer Kicker und barrierefreier Name des Dialogs */
  title: string;
  /** aria-label des Schließen-Buttons */
  closeLabel: string;
  /** Bereichsfarbe für Glow, Hover und Fokusring */
  accentColor: string;
  /** id des Sheets, damit der Trigger per aria-controls darauf zeigt */
  id?: string;
  /** Optionaler Slot rechts oben neben dem Schließen-Button (z. B. Suche) */
  leading?: ReactNode;
  /** Optionaler Kopfbereich unter der TopBar (z. B. angemeldeter Nutzer) */
  header?: ReactNode;
  /** Inhalt in Sektionen (Navigation, Bereiche, Konto …) */
  sections: MobileMenuSection[];
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

export function MobileMenu({
  open,
  onClose,
  title,
  closeLabel,
  accentColor,
  id,
  leading,
  header,
  sections,
}: MobileMenuProps) {
  const reduce = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Fokus-Management + Body-Scroll-Lock, solange offen.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  const sheetMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.98 },
        transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
      };

  const listMotion = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduce ? 0 : 0.05,
        delayChildren: reduce ? 0 : 0.1,
      },
    },
  };

  const itemMotion = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
        },
      };

  const onOverlayKeyDown = (event: ReactKeyboardEvent) => {
    // Tastendrücke im Dialog nicht nach außen durchsacken lassen
    event.stopPropagation();
  };

  // Sektionen zu einer flachen, gestaffelten Blockliste ausrollen
  const blocks: ReactNode[] = [];
  sections.forEach((section, si) => {
    if (section.label) {
      blocks.push(
        <SectionLabel key={`label-${si}`} variants={itemMotion}>
          {section.label}
        </SectionLabel>
      );
    }
    if (section.layout === "grid") {
      // Alle Items als kompakte Buttons in einer Reihe (staffelt als ein Block)
      blocks.push(
        <GridBlock key={`grid-${si}`} variants={itemMotion}>
          {section.items}
        </GridBlock>
      );
      return;
    }
    section.items.forEach((item, ii) => {
      blocks.push(
        <Item key={`item-${si}-${ii}`} variants={itemMotion}>
          {item}
        </Item>
      );
    });
  });

  return (
    <BodyPortal>
      <AnimatePresence>
        {open ? (
          <Sheet
            ref={sheetRef}
            id={id}
            $accent={accentColor}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onKeyDown={onOverlayKeyDown}
            {...sheetMotion}
          >
            <TopBar>
              <Kicker aria-hidden>{title}</Kicker>
              <TopActions>
                {leading}
                <CloseButton
                  ref={closeRef}
                  type="button"
                  $accent={accentColor}
                  aria-label={closeLabel}
                  onClick={onClose}
                >
                  ✕
                </CloseButton>
              </TopActions>
            </TopBar>

            {header ? <MenuHeader>{header}</MenuHeader> : null}

            <Body
              $accent={accentColor}
              variants={listMotion}
              initial="hidden"
              animate="visible"
            >
              {blocks}
            </Body>
          </Sheet>
        ) : null}
      </AnimatePresence>
    </BodyPortal>
  );
}
