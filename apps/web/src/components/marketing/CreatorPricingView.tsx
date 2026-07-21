"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import { startApiPlanCheckout } from "@/app/actions/billing-actions";
import {
  Badge,
  Muted,
  PrimaryButton,
} from "@/components/ui/primitives";
import { FormAlert } from "@/components/auth/AuthShell";

const Grid = styled.div`
  display: grid;
  gap: 1.25rem;
  margin-top: 1.75rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(3, 1fr);
    align-items: start;
  }
`;

const PlanCard = styled(motion.article)<{ $featured?: boolean }>`
  position: relative;
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: 2rem 1.6rem;
  border: 1px solid
    ${({ theme, $featured }) =>
      $featured ? theme.colors.violet : theme.colors.border};
  background: ${({ theme, $featured }) =>
    $featured
      ? `radial-gradient(ellipse 120% 90% at 50% -20%, rgba(139,124,255,0.14), transparent), ${theme.colors.bgElevated}`
      : theme.colors.surface};
  box-shadow: ${({ theme, $featured }) =>
    $featured ? theme.shadows.violetGlow : "none"};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    ${({ $featured }) => ($featured ? "transform: translateY(-12px);" : "")}
  }
`;

const PlanName = styled.h2`
  font-size: 1.4rem;
`;

const PlanPrice = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2.6rem;
  margin-top: 1rem;

  span {
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const PlanDesc = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.92rem;
  margin-top: 0.25rem;
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 1.5rem 0 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  font-size: 0.92rem;

  li {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;

    &::before {
      content: "✦";
      color: ${({ theme }) => theme.colors.violet};
      font-size: 0.7rem;
      flex-shrink: 0;
    }
  }
`;

const CtaLink = styled(Link)<{ $featured?: boolean }>`
  display: block;
  text-align: center;
  padding: 0.85rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  text-decoration: none;
  font-weight: 600;
  ${({ theme, $featured }) =>
    $featured
      ? `background: ${theme.colors.violet}; color: #fff;`
      : `border: 1px solid ${theme.colors.borderStrong}; color: ${theme.colors.text};`}

  &:hover {
    filter: brightness(1.1);
  }
`;

const CtaExternal = styled.a`
  display: block;
  text-align: center;
  padding: 0.85rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  text-decoration: none;
  font-weight: 600;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  color: ${({ theme }) => theme.colors.text};

  &:hover {
    filter: brightness(1.1);
  }
`;

const IntervalToggle = styled.div`
  display: inline-flex;
  gap: 0.15rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 0.15rem;
  margin-bottom: 1rem;
`;

const IntervalButton = styled.button<{ $active: boolean }>`
  font-size: 0.78rem;
  padding: 0.4rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.violet : "transparent"};
  color: ${({ theme, $active }) => ($active ? "#fff" : theme.colors.textMuted)};
`;

const RecommendBadge = styled(Badge)`
  position: absolute;
  top: -0.85rem;
  left: 50%;
  transform: translateX(-50%);
  /* Deckender Hintergrund + Blur, damit die Kartenkante nicht durchschimmert */
  background: ${({ theme }) => theme.colors.bgDeep};
  backdrop-filter: blur(10px);
  border: 1px solid rgba(139, 124, 255, 0.55);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
  padding: 0.35rem 0.85rem;
`;

interface CreatorPlansProps {
  isLoggedIn: boolean;
  apiPlanActive: boolean;
}

/** Die drei Creator-Plan-Karten – eingebettet in die zentrale Preisseite. */
export function CreatorPlans({ isLoggedIn, apiPlanActive }: CreatorPlansProps) {
  const t = useTranslations("creatorPricing");
  const locale = useLocale();
  const router = useRouter();
  const [interval, setInterval] = useState<"MONTH" | "YEAR">("YEAR");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubscribe() {
    setError(null);
    startTransition(async () => {
      const result = await startApiPlanCheckout({ interval, locale });
      if (!result.ok) {
        setError(result.error ?? "generic");
        return;
      }
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      // Demo-Modus oder bereits aktiv → direkt zur API-Verwaltung
      router.push({
        pathname: "/creator/distribution",
        query: { api: "1" },
      });
    });
  }

  return (
    <div>
      <Muted>{t("subtitle")}</Muted>

      {error ? (
        <FormAlert $tone="error" role="alert" style={{ marginTop: "1rem" }}>
          {error}
        </FormAlert>
      ) : null}

      <Grid>
          <PlanCard
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <PlanName>{t("freeName")}</PlanName>
            <PlanPrice>
              {t("freePrice")} <span>{t("freeUnit")}</span>
            </PlanPrice>
            <PlanDesc>{t("freeDesc")}</PlanDesc>
            <FeatureList>
              <li>{t("freeF1")}</li>
              <li>{t("freeF2")}</li>
              <li>{t("freeF3")}</li>
              <li>{t("freeF4")}</li>
            </FeatureList>
            <CtaLink href={isLoggedIn ? "/creator" : "/register"}>
              {t("freeCta")}
            </CtaLink>
          </PlanCard>

          <PlanCard
            $featured
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
          >
            <RecommendBadge $tone="violet">{t("recommended")}</RecommendBadge>
            <PlanName>{t("apiName")}</PlanName>

            <PlanPrice>
              {interval === "YEAR" ? t("apiPriceYearly") : t("apiPriceMonthly")}{" "}
              <span>{t("apiUnit")}</span>
            </PlanPrice>
            {interval === "YEAR" ? (
              <Muted style={{ fontSize: "0.78rem" }}>{t("apiYearlyHint")}</Muted>
            ) : null}
            <PlanDesc>{t("apiDesc")}</PlanDesc>

            <IntervalToggle
              role="group"
              aria-label={`${t("billedMonthly")} / ${t("billedYearly")}`}
              style={{ marginTop: "0.75rem" }}
            >
              <IntervalButton
                type="button"
                $active={interval === "MONTH"}
                aria-pressed={interval === "MONTH"}
                onClick={() => setInterval("MONTH")}
              >
                {t("billedMonthly")}
              </IntervalButton>
              <IntervalButton
                type="button"
                $active={interval === "YEAR"}
                aria-pressed={interval === "YEAR"}
                onClick={() => setInterval("YEAR")}
              >
                {t("billedYearly")}
              </IntervalButton>
            </IntervalToggle>

            <FeatureList>
              <li>{t("apiF1")}</li>
              <li>{t("apiF2")}</li>
              <li>{t("apiF3")}</li>
              <li>{t("apiF4")}</li>
            </FeatureList>

            {apiPlanActive ? (
              <CtaLink href="/creator/distribution" $featured>
                {t("apiCtaActive")}
              </CtaLink>
            ) : isLoggedIn ? (
              <PrimaryButton
                onClick={onSubscribe}
                disabled={pending}
                style={{ width: "100%", background: "#8B7CFF", color: "#fff" }}
              >
                {t("apiCta")}
              </PrimaryButton>
            ) : (
              <CtaLink href="/register" $featured>
                {t("apiCta")}
              </CtaLink>
            )}
          </PlanCard>

          <PlanCard
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
          >
            <PlanName>{t("selfName")}</PlanName>
            <PlanPrice style={{ fontSize: "1.8rem" }}>
              {t("selfPrice")}
            </PlanPrice>
            <PlanDesc>{t("selfDesc")}</PlanDesc>
            <FeatureList>
              <li>{t("selfF1")}</li>
              <li>{t("selfF2")}</li>
              <li>{t("selfF3")}</li>
            </FeatureList>
            <CtaExternal href="mailto:hello@learnsphere.one?subject=Self-hosted%20LearnSphere">
              {t("selfCta")}
            </CtaExternal>
          </PlanCard>
      </Grid>

      <Muted style={{ marginTop: "2rem", fontSize: "0.85rem" }}>
        {t("note")}
      </Muted>
    </div>
  );
}
