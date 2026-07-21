"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styled from "styled-components";
import { AnimatePresence, motion } from "motion/react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { PrimaryButton } from "@/components/ui/primitives";

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(7, 8, 15, 0.7);
  backdrop-filter: blur(6px);
`;

const Dialog = styled(motion.div)`
  width: 100%;
  max-width: 560px;
  max-height: min(85dvh, 720px);
  display: flex;
  flex-direction: column;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.75rem 0;

  h2 {
    font-size: 1.2rem;
  }
`;

const CloseButton = styled.button`
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textMuted};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const Body = styled.div`
  padding: 1.25rem 1.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 0 1.75rem 1.5rem;
`;

/**
 * Generisches Modal im Stil des ConfirmDialog: Portal nach <body>,
 * Escape/Backdrop-Klick schließen, Inhalt scrollt bei Bedarf.
 */
export function Modal({
  open,
  title,
  closeLabel,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  /** Beschriftung des Schließen-Buttons im Footer (z. B. „Fertig") */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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
              aria-labelledby="modal-title"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.18 }}
            >
              <Head>
                <h2 id="modal-title">{title}</h2>
                <CloseButton
                  ref={closeRef}
                  type="button"
                  aria-label={closeLabel}
                  onClick={onClose}
                >
                  ✕
                </CloseButton>
              </Head>
              <Body>{children}</Body>
              <Footer>
                <PrimaryButton type="button" onClick={onClose}>
                  {closeLabel}
                </PrimaryButton>
              </Footer>
            </Dialog>
          </Overlay>
        ) : null}
      </AnimatePresence>
    </BodyPortal>
  );
}
