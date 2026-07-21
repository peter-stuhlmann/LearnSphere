"use client";

import { useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import type { StatRange } from "@elearning/core/stats";
import { StatsSummary, type CreatorTotals } from "./StatsSummary";
import { Container, Kicker, SectionTitle } from "@/components/ui/primitives";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const TopRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
`;

const CoursesLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.92rem;
  padding: 0.6rem 1.2rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  color: ${({ theme }) => theme.colors.text};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.accent};
  }
`;

interface DashboardViewProps {
  userName: string;
  statsRange: StatRange;
  statsTotals: CreatorTotals;
}

export function DashboardView({
  userName,
  statsRange,
  statsTotals,
}: DashboardViewProps) {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");

  return (
    <Wrap id="main">
      <Container>
        <TopRow>
          <div>
            <Kicker>{t("title")}</Kicker>
            <SectionTitle as="h1">
              {t("welcome", { name: userName || "Creator" })}
            </SectionTitle>
          </div>
          <CoursesLink href="/creator/courses">
            {tNav("myCourses")} →
          </CoursesLink>
        </TopRow>

        <div style={{ marginTop: "2rem" }}>
          <StatsSummary
            range={statsRange}
            totals={statsTotals}
            pathname="/creator"
          />
        </div>

      </Container>
    </Wrap>
  );
}
