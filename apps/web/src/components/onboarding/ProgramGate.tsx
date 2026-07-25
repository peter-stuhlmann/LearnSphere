"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  joinBusinessProgram,
  joinCreatorProgram,
} from "@/app/actions/program-actions";
import { FormAlert } from "@/components/auth/AuthShell";
import {
  Container,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";

/**
 * Fullscreen-Freischaltung für gesperrte Bereiche: Programm-Bedingungen
 * lesen, akzeptieren, einmalig freischalten. Danach ist der Bereich
 * dauerhaft offen (Zeitstempel am Konto).
 */

const Wrap = styled.main`
  min-height: 70vh;
  display: flex;
  align-items: center;
  padding: 4rem 0;
`;

const GateCard = styled(motion.div)<{ $accent: string }>`
  max-width: 640px;
  margin: 0 auto;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-top: 3px solid ${({ $accent }) => $accent};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 2.25rem 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: 2.75rem 2.5rem;
  }
`;

const TermsBox = styled.div`
  margin: 1.5rem 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  padding: 1rem 1.2rem;
  font-size: 0.88rem;
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.textMuted};

  ul {
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
`;

const AcceptRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
  cursor: pointer;

  input {
    margin-top: 0.2rem;
    width: 18px;
    height: 18px;
    accent-color: ${({ theme }) => theme.colors.accent};
  }
`;

export function ProgramGate({ program }: { program: "creator" | "business" }) {
  const t = useTranslations(
    program === "creator" ? "creatorGate" : "businessGate"
  );
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function onUnlock() {
    if (!accepted || pending) return;
    setPending(true);
    setError(false);
    const action =
      program === "creator" ? joinCreatorProgram : joinBusinessProgram;
    const result = await action({ acceptTerms: accepted });
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  const accent = program === "creator" ? "#8B7CFF" : "#FFB84D";

  return (
    <Wrap id="main">
      <Container>
        <GateCard
          $accent={accent}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Kicker>{t("kicker")}</Kicker>
          <SectionTitle as="h1" style={{ fontSize: "2rem" }}>
            {t("title")}
          </SectionTitle>
          <Muted style={{ marginTop: "0.6rem" }}>{t("intro")}</Muted>

          <TermsBox tabIndex={0} aria-label={t("termsLabel")}>
            <ul>
              <li>{t("terms.point1")}</li>
              <li>{t("terms.point2")}</li>
              <li>{t("terms.point3")}</li>
              <li>{t("terms.point4")}</li>
            </ul>
            <p style={{ marginTop: "0.8rem" }}>
              {t.rich("termsFull", {
                link: (chunks) => <Link href="/terms">{chunks}</Link>,
              })}
            </p>
          </TermsBox>

          <AcceptRow>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>{t("accept")}</span>
          </AcceptRow>

          <PrimaryButton
            type="button"
            disabled={!accepted || pending}
            onClick={() => void onUnlock()}
          >
            {pending ? t("unlocking") : t("unlockButton")}
          </PrimaryButton>

          {error ? (
            <FormAlert
              $tone="error"
              role="alert"
              style={{ marginTop: "1rem" }}
            >
              {t("error")}
            </FormAlert>
          ) : null}
        </GateCard>
      </Container>
    </Wrap>
  );
}
