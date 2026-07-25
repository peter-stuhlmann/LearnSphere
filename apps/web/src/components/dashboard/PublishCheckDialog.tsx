"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { AnimatePresence, motion } from "motion/react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { GhostButton, PrimaryButton } from "@/components/ui/primitives";
import type {
  PublishBlocker,
  PublishWarning,
} from "@elearning/core/course-publish";

/**
 * Dialog beim Veröffentlichen: Blocker (rot) verhindern es, Warnungen (gelb)
 * lassen sich mit „Trotzdem veröffentlichen" übergehen. Der Server liefert
 * immer entweder Blocker ODER Warnungen – nie beides gleichzeitig.
 */

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
  max-width: 460px;
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

const IssueList = styled.ul<{ $blocking: boolean }>`
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;

  li {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    font-size: 0.92rem;
    color: ${({ theme }) => theme.colors.text};
  }

  li::before {
    content: ${({ $blocking }) => ($blocking ? '"✗"' : '"⚠"')};
    color: ${({ theme, $blocking }) =>
      $blocking ? theme.colors.danger : theme.colors.business};
    font-weight: 700;
    flex: none;
  }
`;

const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.5rem;
`;

export function PublishCheckDialog({
  open,
  blockers,
  warnings,
  onPublishAnyway,
  onClose,
}: {
  open: boolean;
  blockers: PublishBlocker[];
  warnings: PublishWarning[];
  onPublishAnyway: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  const closeRef = useRef<HTMLButtonElement>(null);
  const isBlocked = blockers.length > 0;

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
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="publish-check-title"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.18 }}
            >
              <h2 id="publish-check-title">
                {isBlocked
                  ? t("publishCheckBlockTitle")
                  : t("publishCheckWarnTitle")}
              </h2>
              <p>
                {isBlocked
                  ? t("publishCheckBlockIntro")
                  : t("publishCheckWarnIntro")}
              </p>
              <IssueList $blocking={isBlocked}>
                {isBlocked
                  ? blockers.map((code) => (
                      <li key={code}>{t(`publishBlocker.${code}` as never)}</li>
                    ))
                  : warnings.map((code) => (
                      <li key={code}>{t(`publishWarning.${code}` as never)}</li>
                    ))}
              </IssueList>
              <Buttons>
                {isBlocked ? (
                  <PrimaryButton ref={closeRef} type="button" onClick={onClose}>
                    {t("publishUnderstood")}
                  </PrimaryButton>
                ) : (
                  <>
                    <GhostButton ref={closeRef} type="button" onClick={onClose}>
                      {t("publishFixFirst")}
                    </GhostButton>
                    <PrimaryButton type="button" onClick={onPublishAnyway}>
                      {t("publishAnyway")}
                    </PrimaryButton>
                  </>
                )}
              </Buttons>
            </Dialog>
          </Overlay>
        ) : null}
      </AnimatePresence>
    </BodyPortal>
  );
}
