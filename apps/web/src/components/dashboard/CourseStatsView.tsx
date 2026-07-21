"use client";

import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@elearning/core/format";
import { heatAreaPath } from "@elearning/core/heatmap";
import { biggestDrop, type FunnelStep, type QuizStats } from "@elearning/core/course-analytics";
import {
  Badge,
  Container,
  Kicker,
  Muted,
  SectionTitle,
} from "@/components/ui/primitives";
import { StatTile, TileGrid } from "@/components/charts/StatTile";
import { HBarList } from "@/components/charts/HBarList";

const Wrap = styled.main`
  padding: 4rem 0 3rem;
`;

const BackLink = styled(Link)`
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const Section = styled.section`
  margin-top: 2.5rem;

  h2 {
    font-size: 1.15rem;
    margin-bottom: 1rem;
  }
`;

const RetentionGrid = styled.div`
  display: grid;
  gap: 1rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const RetentionCard = styled.figure`
  margin: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.1rem 1.25rem;

  figcaption {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 0.6rem;

    strong {
      font-size: 0.92rem;
    }

    span {
      font-family: ${({ theme }) => theme.fonts.mono};
      font-size: 0.72rem;
      color: ${({ theme }) => theme.colors.textFaint};
      white-space: nowrap;
    }
  }

  svg {
    display: block;
    width: 100%;
    height: 56px;
  }
`;

const DropNote = styled.p`
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

interface CourseStatsViewProps {
  course: { id: string; title: string };
  kpis: {
    enrollments: number;
    revenueCents: number;
    completed: number;
    certificates: number;
    ratingAverage: number | null;
    ratingCount: number;
  };
  funnel: FunnelStep[];
  quizzes: { id: string; title: string; kind: string; stats: QuizStats }[];
  retention: {
    blockId: string;
    title: string;
    lessonTitle: string;
    durationSeconds: number;
    curve: number[] | null;
  }[];
}

/**
 * Kurs-Analytics für Creator: Teilnahme-KPIs, Lektions-Funnel (wo steigen
 * Lernende aus?), Bestehensquoten der Prüfungen und Video-Retention mit
 * größter Absprungstelle.
 */
export function CourseStatsView({
  course,
  kpis,
  funnel,
  quizzes,
  retention,
}: CourseStatsViewProps) {
  const t = useTranslations("courseStats");
  const locale = useLocale();

  const completionPercent =
    kpis.enrollments > 0
      ? Math.round((kpis.completed / kpis.enrollments) * 100)
      : null;

  return (
    <Wrap id="main">
      <Container>
        <BackLink
          href={{
            pathname: "/creator/courses/[id]",
            params: { id: course.id },
          }}
        >
          ← {t("backToCourse")}
        </BackLink>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle as="h1">{course.title}</SectionTitle>

        <TileGrid style={{ marginTop: "2rem" }}>
          <StatTile label={t("enrollments")} value={kpis.enrollments} />
          <StatTile
            label={t("revenue")}
            value={formatPrice(kpis.revenueCents, "EUR", locale)}
          />
          <StatTile
            label={t("completionRate")}
            value={completionPercent !== null ? `${completionPercent} %` : "–"}
          />
          <StatTile label={t("certificates")} value={kpis.certificates} />
          <StatTile
            label={t("rating")}
            value={
              kpis.ratingAverage !== null
                ? `★ ${kpis.ratingAverage.toLocaleString(locale, {
                    maximumFractionDigits: 1,
                  })}`
                : "–"
            }
          />
        </TileGrid>

        <Section aria-labelledby="funnel-title">
          <h2 id="funnel-title">{t("funnelTitle")}</h2>
          <Muted style={{ marginBottom: "1rem", fontSize: "0.85rem" }}>
            {t("funnelHint")}
          </Muted>
          <HBarList
            title={t("funnelCaption", { count: kpis.enrollments })}
            emptyLabel={t("noData")}
            items={funnel.map((step) => ({
              label: step.title,
              value: step.completionPercent,
              display: `${step.completionPercent} % · ${step.completed}/${kpis.enrollments}`,
            }))}
          />
        </Section>

        <Section aria-labelledby="quiz-title">
          <h2 id="quiz-title">{t("quizTitle")}</h2>
          <HBarList
            title={t("quizCaption")}
            emptyLabel={t("noData")}
            items={quizzes.map((quiz) => ({
              label:
                quiz.kind === "FINAL"
                  ? `🎓 ${quiz.title}`
                  : quiz.title,
              value: quiz.stats.passRatePercent,
              display: t("quizDisplay", {
                rate: quiz.stats.passRatePercent,
                avg: quiz.stats.averageBestScore.toLocaleString(locale),
                attempts: quiz.stats.attempts,
              }),
            }))}
          />
        </Section>

        <Section aria-labelledby="retention-title">
          <h2 id="retention-title">{t("retentionTitle")}</h2>
          <Muted style={{ marginBottom: "1rem", fontSize: "0.85rem" }}>
            {t("retentionHint")}
          </Muted>
          {retention.length === 0 ? (
            <Muted>{t("noMedia")}</Muted>
          ) : (
            <RetentionGrid>
              {retention.map((block) => {
                const drop = block.curve ? biggestDrop(block.curve) : null;
                const dropPercent = drop
                  ? Math.round(
                      ((drop.bucket + 1) / (block.curve?.length ?? 1)) * 100
                    )
                  : null;
                return (
                  <RetentionCard key={block.blockId}>
                    <figcaption>
                      <strong>{block.title}</strong>
                      <span>{block.lessonTitle}</span>
                    </figcaption>
                    {block.curve ? (
                      <>
                        <svg
                          viewBox="0 0 100 20"
                          preserveAspectRatio="none"
                          role="img"
                          aria-label={t("retentionAria", {
                            title: block.title,
                          })}
                        >
                          <path
                            d={heatAreaPath(block.curve)}
                            fill="rgba(167, 139, 250, 0.35)"
                            stroke="rgba(167, 139, 250, 0.9)"
                            strokeWidth="0.5"
                          />
                          {drop ? (
                            <line
                              x1={((drop.bucket + 0.5) / block.curve.length) * 100}
                              x2={((drop.bucket + 0.5) / block.curve.length) * 100}
                              y1="0"
                              y2="20"
                              stroke="rgba(255, 107, 107, 0.9)"
                              strokeWidth="0.6"
                              strokeDasharray="1.5 1"
                            />
                          ) : null}
                        </svg>
                        {drop && dropPercent !== null ? (
                          <DropNote>
                            {t("dropAt", {
                              percent: dropPercent,
                              lost: Math.round(drop.drop * 100),
                            })}
                          </DropNote>
                        ) : (
                          <DropNote>{t("noDrop")}</DropNote>
                        )}
                      </>
                    ) : (
                      <Badge $tone="muted">{t("notEnoughData")}</Badge>
                    )}
                  </RetentionCard>
                );
              })}
            </RetentionGrid>
          )}
        </Section>
      </Container>
    </Wrap>
  );
}
