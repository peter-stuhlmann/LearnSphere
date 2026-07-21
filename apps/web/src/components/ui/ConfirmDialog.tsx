"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";
import { AnimatePresence, motion } from "motion/react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { DangerButton, GhostButton } from "@/components/ui/primitives";

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
  max-width: 420px;
  padding: 1.75rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: ${({ theme }) => theme.shadows.card};

  h2 {
    font-size: 1.2rem;
  }

  p {
    margin-top: 0.6rem;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.92rem;
  }
`;

const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.5rem;
`;

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Hübscher Bestätigungsdialog als Ersatz für window.confirm. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Fokus sicher auf die harmlose Option legen; Escape bricht ab
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  // Portal nach <body>: Vorfahren mit backdrop-filter/transform (z. B. der
  // sticky Header) würden das fixed-Overlay sonst einfangen
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
            if (e.target === e.currentTarget) onCancel();
          }}
        >
          <Dialog
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            <h2 id="confirm-title">{title}</h2>
            <p id="confirm-message">{message}</p>
            <Buttons>
              <GhostButton ref={cancelRef} type="button" onClick={onCancel}>
                {cancelLabel}
              </GhostButton>
              <DangerButton type="button" onClick={onConfirm}>
                {confirmLabel}
              </DangerButton>
            </Buttons>
          </Dialog>
        </Overlay>
      ) : null}
    </AnimatePresence>
    </BodyPortal>
  );
}
