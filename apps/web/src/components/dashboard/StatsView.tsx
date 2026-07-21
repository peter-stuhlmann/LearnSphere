"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { formatMoney } from "@elearning/core/format";
import type { DailyPoint, StatRange } from "@elearning/core/stats";
import { heatAreaPath } from "@elearning/core/heatmap";
import { Container, Kicker, Muted, SectionTitle } from "@/components/ui/primitives";
import { AreaChart } from "@/components/charts/AreaChart";
import { HBarList } from "@/components/charts/HBarList";
import { StatsSummary, type CreatorTotals } from "./StatsSummary";

const Skyline3D = dynamic(
  () => import("@/components/charts/Skyline3D").then((m) => m.Skyline3D),
  { ssr: false }
);

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const ChartGrid = styled.div`
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const Section = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

/* ---------- Video-Heatmap (wo wird geschaut, wo gesprungen?) ---------- */

const HeatSection = styled.section`
  margin-top: 1.5rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;

  h3 {
    font-size: 1.05rem;
  }
`;

const HeatRow = styled.div`
  display: grid;
  gap: 0.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 260px 1fr;
    align-items: center;
    gap: 1rem;
  }
`;

const HeatLabel = styled.div`
  min-width: 0;

  strong {
    display: block;
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span {
    font-size: 0.76rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const HeatChart = styled.svg`
  width: 100%;
  height: 44px;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};

  path {
    fill: rgba(139, 124, 255, 0.35);
    stroke: ${({ theme }) => theme.colors.violet};
    stroke-width: 0.5;
  }
`;

interface VideoHeatmapEntry {
  blockId: string;
  label: string;
  courseTitle: string;
  type: string;
  total: number;
  /** normalisierte Kurve (0..1 je Bucket) */
  heat: number[];
}

interface StatsViewProps {
  range: StatRange;
  totals: CreatorTotals;
  revenueSeries: DailyPoint[];
  salesSeries: DailyPoint[];
  courseStats: { title: string; revenueCents: number; sales: number }[];
  ratingBuckets: number[];
  videoHeatmaps: VideoHeatmapEntry[];
}

export function StatsView({
  range,
  totals,
  revenueSeries,
  salesSeries,
  courseStats,
  ratingBuckets,
  videoHeatmaps,
}: StatsViewProps) {
  const t = useTranslations("stats");
  const locale = useLocale();

  const euro = (cents: number) => formatMoney(cents || 0, "EUR", locale);
  const totalRatings = ratingBuckets.reduce((sum, n) => sum + n, 0);

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>

        <div style={{ marginTop: "1.5rem" }}>
          <StatsSummary
            range={range}
            totals={totals}
            pathname="/creator/stats"
          />
        </div>

        <Section>
          <ChartGrid>
            <AreaChart
              title={t("revenuePerDay")}
              series={revenueSeries}
              formatValue={euro}
              totalLabel={euro(totals.revenueCents)}
              tableLabel={t("showTable")}
              dateLabel={t("date")}
              valueLabel={t("revenue")}
              locale={locale}
            />
            <AreaChart
              title={t("salesPerDay")}
              series={salesSeries}
              formatValue={(v) => `${v}`}
              totalLabel={`${totals.sales}`}
              tableLabel={t("showTable")}
              dateLabel={t("date")}
              valueLabel={t("sales")}
              locale={locale}
            />
          </ChartGrid>

          <Skyline3D
            title={t("skyline")}
            hint={t("skylineHint")}
            items={courseStats.map((c) => ({
              label: c.title,
              value: c.revenueCents,
              display: euro(c.revenueCents),
            }))}
          />

          <ChartGrid>
            <HBarList
              title={t("topCourses")}
              emptyLabel={t("noData")}
              items={courseStats.map((c) => ({
                label: c.title,
                value: c.revenueCents,
                display: `${euro(c.revenueCents)} · ${c.sales} ×`,
              }))}
            />
            <HBarList
              title={t("ratingDist")}
              emptyLabel={t("noData")}
              items={[5, 4, 3, 2, 1].map((stars) => ({
                label: `${"★".repeat(stars)}`,
                value: ratingBuckets[stars - 1],
                display:
                  totalRatings > 0
                    ? `${ratingBuckets[stars - 1]} (${Math.round(
                        (ratingBuckets[stars - 1] / totalRatings) * 100
                      )} %)`
                    : "0",
              }))}
            />
          </ChartGrid>

          {totals.sales === 0 ? <Muted>{t("noData")}</Muted> : null}

          {videoHeatmaps.length > 0 ? (
            <HeatSection aria-label={t("heatmapTitle")}>
              <h3>{t("heatmapTitle")}</h3>
              <Muted style={{ fontSize: "0.82rem" }}>{t("heatmapHint")}</Muted>
              {videoHeatmaps.map((entry) => (
                <HeatRow key={entry.blockId}>
                  <HeatLabel>
                    <strong>{entry.label}</strong>
                    <span>
                      {entry.courseTitle} ·{" "}
                      {t("heatmapViews", { count: entry.total })}
                    </span>
                  </HeatLabel>
                  <HeatChart
                    viewBox="0 0 100 20"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`${entry.label}: ${t("heatmapTitle")}`}
                  >
                    <path d={heatAreaPath(entry.heat)} />
                  </HeatChart>
                </HeatRow>
              ))}
            </HeatSection>
          ) : null}
        </Section>
      </Container>
    </Wrap>
  );
}
