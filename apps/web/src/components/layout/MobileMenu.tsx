"use client";

import {
  Children,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import styled from "styled-components";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BodyPortal } from "@/components/ui/BodyPortal";

/**
 * Vollflächiges Mobil-Menü: öffnet sich smooth über den ganzen Viewport,
 * die Links faden gestaffelt ein. Barrierefrei als modaler Dialog –
 * Fokus-Falle, Escape/Backdrop schließen, Body-Scroll gesperrt, Fokus kehrt
 * beim Schließen zum auslösenden Element zurück. Respektiert
 * prefers-reduced-motion (dann nur ein dezentes Ein-/Ausblenden).
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
  margin-bottom: 1.75rem;
`;

const Kicker = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.68rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
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

const List = styled(motion.ul)<{ $accent: string }>`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;

  /* Die übergebenen Links (NavLink/CtaLink o. ä.) im Vollbild groß und
     großzügig darstellen – unabhängig von ihrem Header-Styling. */
  li {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
  li:last-child {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }

  li > a,
  li > button {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.75rem;
    padding: 1.15rem 0.25rem;
    background: transparent;
    border: none;
    border-radius: 0;
    text-align: left;
    text-decoration: none;
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: 1.6rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: ${({ theme }) => theme.colors.text};
    transition:
      color 160ms ease,
      padding-left 220ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  li > a:hover,
  li > button:hover,
  li > a:focus-visible,
  li > button:focus-visible {
    color: ${({ $accent }) => $accent};
    padding-left: 1rem;
    outline: none;
  }
`;

const Item = styled(motion.li)``;

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  /** Sichtbarer Kicker und barrierefreier Name des Dialogs */
  title: string;
  /** aria-label des Schließen-Buttons */
  closeLabel: string;
  /** Bereichsfarbe für Glow, Hover und Fokusring */
  accentColor: string;
  /** id des Sheets, damit der Burger per aria-controls darauf zeigt */
  id?: string;
  children: ReactNode;
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
  children,
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
      // Fokus-Falle: innerhalb des Dialogs zyklisch
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
        staggerChildren: reduce ? 0 : 0.06,
        delayChildren: reduce ? 0 : 0.12,
      },
    },
  };

  const itemMotion = reduce
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 18 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
        },
      };

  const onOverlayKeyDown = (event: ReactKeyboardEvent) => {
    // Klick-Fallback für Tastatur ist über Escape/Tab abgedeckt; hier nur
    // verhindern, dass Tastendrücke im Dialog nach außen „durchsacken“.
    event.stopPropagation();
  };

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
              <CloseButton
                ref={closeRef}
                type="button"
                $accent={accentColor}
                aria-label={closeLabel}
                onClick={onClose}
              >
                ✕
              </CloseButton>
            </TopBar>

            <List
              $accent={accentColor}
              variants={listMotion}
              initial="hidden"
              animate="visible"
            >
              {Children.toArray(children).map((child, index) => (
                <Item key={index} variants={itemMotion}>
                  {child}
                </Item>
              ))}
            </List>
          </Sheet>
        ) : null}
      </AnimatePresence>
    </BodyPortal>
  );
}
