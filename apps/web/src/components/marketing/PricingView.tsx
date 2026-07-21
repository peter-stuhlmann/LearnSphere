"use client";

import { useTranslations } from "next-intl";
import styled from "styled-components";
import { Container, Kicker, SectionTitle } from "@/components/ui/primitives";
import { CreatorPlans } from "./CreatorPricingView";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Faq = styled.section`
  margin-top: 5rem;
  max-width: 720px;
`;

const FaqItem = styled.details`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding: 1.1rem 0;

  summary {
    cursor: pointer;
    font-weight: 600;
    list-style: none;
    display: flex;
    justify-content: space-between;
    gap: 1rem;

    &::after {
      content: "+";
      font-family: ${({ theme }) => theme.fonts.mono};
      color: ${({ theme }) => theme.colors.accent};
    }
  }

  &[open] summary::after {
    content: "–";
  }

  p {
    margin-top: 0.75rem;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.94rem;
  }
`;

interface PricingViewProps {
  isLoggedIn: boolean;
  apiPlanActive: boolean;
}

/**
 * Die Preisseite richtet sich ausschließlich an Creator –
 * Lernende zahlen einfach pro Kurs (Preis steht am Kurs).
 */
export function PricingView({ isLoggedIn, apiPlanActive }: PricingViewProps) {
  const t = useTranslations("creatorPricing");
  const tFaq = useTranslations("pricing");

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>

        <div style={{ marginTop: "0.75rem" }}>
          <CreatorPlans isLoggedIn={isLoggedIn} apiPlanActive={apiPlanActive} />
        </div>

        <Faq aria-labelledby="faq-title">
          <SectionTitle as="h2" id="faq-title" style={{ fontSize: "1.75rem" }}>
            {tFaq("faqTitle")}
          </SectionTitle>
          {[1, 2, 3].map((i) => (
            <FaqItem key={i}>
              <summary>{tFaq(`faq${i}Q` as never)}</summary>
              <p>{tFaq(`faq${i}A` as never)}</p>
            </FaqItem>
          ))}
        </Faq>
      </Container>
    </Wrap>
  );
}
