"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { AnimatePresence, motion } from "motion/react";
import { BodyPortal } from "@/components/ui/BodyPortal";

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 65;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(7, 8, 15, 0.7);
  backdrop-filter: blur(6px);
`;

const Dialog = styled(motion.div)`
  width: 100%;
  max-width: 340px;
  padding: 1.6rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: ${({ theme }) => theme.shadows.card};

  h2 {
    font-size: 1.15rem;
    margin-bottom: 1rem;
  }
`;

const Option = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.8rem 1rem;
  border-radius: ${({ theme }) => theme.radii.md};
  font-size: 0.95rem;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? "rgba(200, 255, 77, 0.5)" : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.text};

  & + & {
    margin-top: 0.5rem;
  }

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const LOCALES = [
  { id: "de", labelKey: "german" as const },
  { id: "en", labelKey: "english" as const },
];

/** Sprachwahl-Modal – vom Header (Globus-Button bzw. Avatar-Menü) geöffnet. */
export function LanguageModal({
  open,
  current,
  onSelect,
  onClose,
}: {
  open: boolean;
  current: string;
  onSelect: (locale: string) => void;
  onClose: () => void;
}) {
  const tc = useTranslations("common");
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    activeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Portal nach <body>: im Header würde dessen backdrop-filter das
  // fixed-Overlay einfangen (Containing Block) statt im Viewport zu zentrieren
  return (
    <BodyPortal>
    <AnimatePresence>
      {open ? (
        <Overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <Dialog
            role="dialog"
            aria-modal="true"
            aria-labelledby="language-modal-title"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            <h2 id="language-modal-title">{tc("languageSwitcher")}</h2>
            {LOCALES.map((entry) => (
              <Option
                key={entry.id}
                ref={entry.id === current ? activeRef : undefined}
                type="button"
                $active={entry.id === current}
                aria-pressed={entry.id === current}
                onClick={() => onSelect(entry.id)}
              >
                {tc(entry.labelKey)}
                {entry.id === current ? <span aria-hidden>✓</span> : null}
              </Option>
            ))}
          </Dialog>
        </Overlay>
      ) : null}
    </AnimatePresence>
    </BodyPortal>
  );
}
