"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  joinAffiliateProgram,
  leaveAffiliateProgram,
} from "@/app/actions/affiliate-actions";
import { formatMoney } from "@elearning/core/format";
import {
  Card,
  Container,
  DangerButton,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormAlert } from "@/components/auth/AuthShell";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Lead = styled.p`
  max-width: 58ch;
  margin-top: 1rem;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 1.05rem;
`;

const Steps = styled.ol`
  list-style: none;
  padding: 0;
  display: grid;
  gap: 1rem;
  margin-top: 2.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const Step = styled(motion.li)`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.5rem;

  span {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.partner};
  }

  h2 {
    font-size: 1.1rem;
    margin: 0.4rem 0 0.5rem;
  }

  p {
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const TermsList = styled.ul`
  padding-left: 1.25rem;
  margin-top: 0.75rem;

  li {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.92rem;
    margin-top: 0.45rem;
  }
`;

const AcceptRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  margin-top: 1.25rem;
  cursor: pointer;
  font-size: 0.92rem;

  input {
    margin-top: 0.15rem;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    accent-color: ${({ theme }) => theme.colors.accent};
  }
`;

const LinkBox = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.75rem;

  code {
    flex: 1;
    min-width: 200px;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.85rem;
    padding: 0.7rem 1rem;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.md};
    background: ${({ theme }) => theme.colors.bgDeep};
    overflow-x: auto;
    white-space: nowrap;
  }
`;

const StatGrid = styled.div`
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const StatTile = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 1rem 1.2rem;

  p:first-child {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: ${({ theme }) => theme.colors.textFaint};
  }

  p:last-child {
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: 1.6rem;
    margin-top: 0.3rem;
    color: ${({ theme }) => theme.colors.partner};
  }
`;

export interface AffiliateMember {
  joined: boolean;
  code: string | null;
  earnedCents: number;
  salesCount: number;
  balanceCents: number;
}

interface AffiliateViewProps {
  loggedIn: boolean;
  member: AffiliateMember | null;
  appUrl: string;
}

export function AffiliateView({ loggedIn, member, appUrl }: AffiliateViewProps) {
  const t = useTranslations("affiliateProgram");
  const locale = useLocale();
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pending, startTransition] = useTransition();

  const affiliateLink = member?.code
    ? `${appUrl}/${locale}/${locale === "de" ? "kurse" : "courses"}?aff=${member.code}`
    : "";

  function onJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinAffiliateProgram({ acceptTerms: accepted });
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      router.refresh();
    });
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(affiliateLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard nicht verfügbar – Link bleibt markierbar
    }
  }

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <Lead>{t("lead")}</Lead>

        <Steps>
          {[1, 2, 3].map((n, i) => (
            <Step
              key={n}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              <span>0{n}</span>
              <h2>{t(`step${n}Title` as never)}</h2>
              <p>{t(`step${n}Text` as never)}</p>
            </Step>
          ))}
        </Steps>

        <Card as="section" style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.15rem" }}>{t("termsTitle")}</h2>
          <TermsList>
            <li>{t("term1")}</li>
            <li>{t("term2")}</li>
            <li>{t("term3")}</li>
            <li>{t("term4")}</li>
            <li>{t("term5")}</li>
          </TermsList>

          {member?.joined ? null : loggedIn ? (
            <>
              {error ? (
                <FormAlert
                  $tone="error"
                  role="alert"
                  style={{ marginTop: "1rem" }}
                >
                  {error === "terms_required"
                    ? t("errors.terms_required")
                    : error}
                </FormAlert>
              ) : null}
              <AcceptRow>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                {t("acceptTerms")}
              </AcceptRow>
              <PrimaryButton
                style={{ marginTop: "1.25rem" }}
                disabled={pending || !accepted}
                onClick={onJoin}
              >
                {t("join")}
              </PrimaryButton>
            </>
          ) : (
            <div style={{ marginTop: "1.25rem" }}>
              <Muted>{t("joinLoginFirst")}</Muted>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.9rem" }}>
                <PrimaryButton
                  onClick={() => router.push("/login")}
                >
                  {t("login")}
                </PrimaryButton>
                <GhostButton onClick={() => router.push("/register")}>
                  {t("register")}
                </GhostButton>
              </div>
            </div>
          )}
        </Card>

        {member?.joined && member.code ? (
          <Card as="section" style={{ marginTop: "1.5rem" }}>
            <h2 style={{ fontSize: "1.15rem" }}>✓ {t("joined")}</h2>
            <Muted style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
              {t("yourLink")}
            </Muted>
            <LinkBox>
              <code>{affiliateLink}</code>
              <GhostButton type="button" onClick={onCopy}>
                {copied ? t("copied") : t("copy")}
              </GhostButton>
            </LinkBox>

            <StatGrid role="group" aria-label={t("joined")}>
              <StatTile>
                <p>{t("statSales")}</p>
                <p>{member.salesCount}</p>
              </StatTile>
              <StatTile>
                <p>{t("statEarned")}</p>
                <p>{formatMoney(member.earnedCents, "EUR", locale)}</p>
              </StatTile>
              <StatTile>
                <p>{t("statBalance")}</p>
                <p>{formatMoney(member.balanceCents, "EUR", locale)}</p>
              </StatTile>
            </StatGrid>

            <Muted style={{ marginTop: "1.25rem", fontSize: "0.88rem" }}>
              {t("apiHint")}{" "}
              <Link href="/api-docs" style={{ color: "#4DD8FF" }}>
                {t("apiDocsLink")}
              </Link>
              .
            </Muted>

            <div style={{ marginTop: "1.5rem" }}>
              <DangerButton
                type="button"
                disabled={pending}
                onClick={() => setConfirmLeave(true)}
              >
                {t("leave")}
              </DangerButton>
            </div>
          </Card>
        ) : null}

        <ConfirmDialog
          open={confirmLeave}
          title={t("leaveConfirmTitle")}
          message={t("leaveConfirmMessage")}
          confirmLabel={t("leave")}
          cancelLabel={t("leaveCancel")}
          onCancel={() => setConfirmLeave(false)}
          onConfirm={() => {
            setConfirmLeave(false);
            startTransition(async () => {
              await leaveAffiliateProgram();
              router.refresh();
            });
          }}
        />
      </Container>
    </Wrap>
  );
}
