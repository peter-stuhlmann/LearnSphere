"use client";

import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@elearning/core/format";
import { STAT_RANGES, type StatRange } from "@elearning/core/stats";
import { StatTile, TileGrid } from "@/components/charts/StatTile";

const FilterRow = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const RangePill = styled(Link)<{ $active: boolean }>`
  text-decoration: none;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.78rem;
  padding: 0.45rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.accent : theme.colors.border};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.onAccent : theme.colors.textMuted};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accent : "transparent"};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const Stars = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  letter-spacing: 0.1em;
`;

export interface CreatorTotals {
  sales: number;
  revenueCents: number;
  learners: number;
  completion: number | null;
  avgRating: number | null;
  reviewCount: number;
}

interface StatsSummaryProps {
  range: StatRange;
  totals: CreatorTotals;
  /** Seite, auf die die Zeitraum-Pills verlinken */
  pathname: "/creator" | "/creator/stats";
}

/** Zeitraum-Filter + die vier Kern-KPIs des Creators (wiederverwendbar). */
export function StatsSummary({ range, totals, pathname }: StatsSummaryProps) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const euro = (cents: number) => formatMoney(cents || 0, "EUR", locale);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <FilterRow aria-label={t("title")}>
        {STAT_RANGES.map((value) => (
          <RangePill
            key={value}
            href={{ pathname, query: { range: value } }}
            $active={value === range}
            aria-current={value === range ? "true" : undefined}
          >
            {t(`range${value}` as never)}
          </RangePill>
        ))}
      </FilterRow>

      <TileGrid>
        <StatTile label={t("sales")} value={totals.sales} />
        <StatTile
          label={t("revenue")}
          value={<em>{euro(totals.revenueCents)}</em>}
        />
        <StatTile
          label={t("avgRating")}
          value={
            totals.avgRating !== null ? (
              <>
                {totals.avgRating.toLocaleString(locale)}{" "}
                <Stars aria-hidden>★</Stars>
              </>
            ) : (
              "–"
            )
          }
          hint={t("reviewCount", { count: totals.reviewCount })}
        />
        <StatTile
          label={t("completion")}
          value={totals.completion !== null ? `${totals.completion} %` : "–"}
          hint={`${t("learners")}: ${totals.learners}`}
        />
      </TileGrid>
    </div>
  );
}
