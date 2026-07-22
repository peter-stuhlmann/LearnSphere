"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import {
  AI_MODEL_PRICES,
  AI_PRICES_AS_OF,
  formatUsd,
  topGroupsWithRest,
  type StackedSeries,
  type UsageGroup,
  type UsageTotals,
} from "@elearning/core/ai-usage";
import { AreaChart, SERIES_VIOLET } from "@/components/charts/AreaChart";
import { HBarList } from "@/components/charts/HBarList";
import { StatTile, TileGrid } from "@/components/charts/StatTile";
import { Kicker, Muted, SectionTitle } from "@/components/ui/primitives";
import { Select } from "@/components/ui/Select";
import { DateRangePicker } from "./DateRangePicker";
import { USAGE_PRESETS, type UsagePreset } from "@/lib/usage-range";

/* Farbpalette für Aktivitäts-Stapel (Reihenfolge = Volumen-Rang) */
const PALETTE = [
  "#C8FF4D",
  "#8B7CFF",
  "#4DD2FF",
  "#FFB84D",
  "#FF6B6B",
  "#6EE7B7",
  "#F472B6",
  "#FDE047",
  "#94A3B8",
  "#38BDF8",
];



const FilterBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin: 1.5rem 0;
`;

const PillRow = styled.div`
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.2rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
`;

const Pill = styled.button<{ $active: boolean }>`
  padding: 0.4rem 0.95rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.82rem;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accent : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.onAccent : theme.colors.textMuted};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};

  &:hover {
    color: ${({ theme, $active }) =>
      $active ? theme.colors.onAccent : theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const Card = styled.section`
  margin-top: 1.5rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.5rem;

  h2 {
    font-size: 1.1rem;
  }
`;

const CardHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const Legend = styled.ul`
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-top: 0.9rem;
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textMuted};

  li {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    display: inline-block;
  }
`;

const ChartSvg = styled.svg`
  width: 100%;
  height: auto;
  display: block;
`;

const DataDetails = styled.details`
  margin-top: 0.9rem;
  font-size: 0.82rem;

  summary {
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textMuted};
  }

  table {
    margin-top: 0.6rem;
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: 0.3rem 0.6rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }

  td.num,
  th.num {
    text-align: right;
    font-family: ${({ theme }) => theme.fonts.mono};
  }
`;

const PriceNote = styled.p`
  margin-top: 1.25rem;
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

type Metric = "tokens" | "cost" | "calls";
type TimeChartKind = "stacked" | "area";
type BreakdownMetric = "tokens" | "cost";

interface LabeledGroup extends UsageGroup {
  label?: string;
}

interface AdminAiUsageViewProps {
  range: UsagePreset | "custom";
  /** aktuell wirksamer Zeitraum als ISO-Tage – auch bei Voreinstellungen */
  customRange: { from: string; to: string };
  /** spätester wählbarer Tag */
  today: string;
  filters: { activity: string | null; model: string | null; user: string | null };
  options: {
    activities: string[];
    models: string[];
    users: { id: string; label: string }[];
  };
  totals: UsageTotals;
  daily: Record<Metric, StackedSeries>;
  byActivity: UsageGroup[];
  byModel: UsageGroup[];
  byUser: LabeledGroup[];
}

/** Gestapelte Tagesbalken (SVG) – je Aktivität eine Farbe. */
function StackedBars({
  data,
  colorOf,
  formatValue,
  labelOf,
  tableLabel,
  dateLabel,
}: {
  data: StackedSeries;
  colorOf: (key: string) => string;
  formatValue: (value: number) => string;
  labelOf: (key: string) => string;
  tableLabel: string;
  dateLabel: string;
}) {
  const width = 640;
  const height = 200;
  const pad = 4;
  const days = data.labels.length;
  const dayTotals = data.labels.map((_, i) =>
    data.keys.reduce((sum, key) => sum + (data.series[key]?.[i] ?? 0), 0)
  );
  const max = Math.max(1e-9, ...dayTotals);
  const barWidth = Math.max(1, (width - pad * 2) / days - 2);

  return (
    <>
      <ChartSvg
        viewBox={`0 0 ${width} ${height + 20}`}
        role="img"
        aria-label={tableLabel}
      >
        {data.labels.map((label, i) => {
          let y = height;
          const x = pad + (i * (width - pad * 2)) / days;
          return (
            <g key={label}>
              {data.keys.map((key) => {
                const value = data.series[key]?.[i] ?? 0;
                if (value <= 0) return null;
                const h = (value / max) * (height - 10);
                y -= h;
                return (
                  <rect
                    key={key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    rx={1.5}
                    fill={colorOf(key)}
                  >
                    <title>{`${label} · ${labelOf(key)}: ${formatValue(value)}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
        <text x={pad} y={height + 15} fontSize="10" fill="#6E7085">
          {data.labels[0]}
        </text>
        <text
          x={width - pad}
          y={height + 15}
          fontSize="10"
          fill="#6E7085"
          textAnchor="end"
        >
          {data.labels[days - 1]}
        </text>
      </ChartSvg>
      <DataDetails>
        <summary>{tableLabel}</summary>
        <table>
          <thead>
            <tr>
              <th>{dateLabel}</th>
              {data.keys.map((key) => (
                <th key={key} className="num">
                  {labelOf(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.labels.map((label, i) =>
              dayTotals[i] > 0 ? (
                <tr key={label}>
                  <td>{label}</td>
                  {data.keys.map((key) => (
                    <td key={key} className="num">
                      {formatValue(data.series[key]?.[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              ) : null
            )}
          </tbody>
        </table>
      </DataDetails>
    </>
  );
}

export function AdminAiUsageView({
  range,
  customRange,
  today,
  filters,
  options,
  totals,
  daily,
  byActivity,
  byModel,
  byUser,
}: AdminAiUsageViewProps) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();

  const [metric, setMetric] = useState<Metric>("tokens");
  const [timeChart, setTimeChart] = useState<TimeChartKind>("stacked");
  const [breakdownMetric, setBreakdownMetric] =
    useState<BreakdownMetric>("cost");

  const activityLabel = (key: string) =>
    t(`aiActivities.${key}` as never) as unknown as string;

  /** Filter/Zeitraum leben in der URL – teilbar und Back-Button-tauglich. */
  function apply(
    next: Partial<{
      range: string;
      from: string;
      to: string;
      activity: string;
      model: string;
      user: string;
    }>
  ) {
    const merged = {
      range,
      activity: filters.activity ?? "",
      model: filters.model ?? "",
      user: filters.user ?? "",
      ...next,
    };
    const query: Record<string, string> = {};
    /* Voreinstellung und freier Zeitraum schließen einander aus – sonst
       stünden zwei widersprüchliche Angaben in der URL. */
    if (next.from && next.to) {
      query.from = next.from;
      query.to = next.to;
    } else if (merged.range !== "30d") {
      query.range = merged.range;
    }
    if (merged.activity) query.activity = merged.activity;
    if (merged.model) query.model = merged.model;
    if (merged.user) query.user = merged.user;
    router.replace({ pathname: "/admin/ai", query });
  }

  const chartData = daily[metric];
  const colorByKey = useMemo(
    () =>
      new Map(chartData.keys.map((key, i) => [key, PALETTE[i % PALETTE.length]])),
    [chartData.keys]
  );
  const colorOf = (key: string) => colorByKey.get(key) ?? SERIES_VIOLET;

  const formatMetric = (value: number) =>
    metric === "cost"
      ? formatUsd(value)
      : Math.round(value).toLocaleString(locale);

  const areaSeries = useMemo(
    () =>
      chartData.labels.map((date, i) => ({
        date,
        value: chartData.keys.reduce(
          (sum, key) => sum + (chartData.series[key]?.[i] ?? 0),
          0
        ),
      })),
    [chartData]
  );

  const breakdownValue = (group: UsageGroup) =>
    breakdownMetric === "cost"
      ? group.totals.costUsd
      : group.totals.inputTokens + group.totals.outputTokens;
  const breakdownDisplay = (group: UsageGroup) =>
    breakdownMetric === "cost"
      ? formatUsd(group.totals.costUsd)
      : `${(group.totals.inputTokens + group.totals.outputTokens).toLocaleString(locale)} T`;

  const audioMinutes = Math.round(totals.audioSeconds / 60);

  return (
    <div>
      <Kicker>{t("title")}</Kicker>
      <SectionTitle as="h1">{t("aiTitle")}</SectionTitle>
      <Muted style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>
        {t("aiIntro")}
      </Muted>

      <FilterBar>
        <PillRow role="group" aria-label={t("aiRangeLabel")}>
          {USAGE_PRESETS.map((value) => (
            <Pill
              key={value}
              type="button"
              $active={range === value}
              aria-pressed={range === value}
              onClick={() => apply({ range: value })}
            >
              {t(`aiRanges.${value}` as never)}
            </Pill>
          ))}
        </PillRow>
        <DateRangePicker
          from={customRange.from}
          to={customRange.to}
          active={range === "custom"}
          maxDay={today}
          onApply={({ from, to }) => apply({ from, to })}
        />
        <Select
          inline
          pill
          ariaLabel={t("aiFilterActivity")}
          value={filters.activity ?? ""}
          options={[
            { value: "", label: t("aiAllActivities") },
            ...options.activities.map((a) => ({
              value: a,
              label: activityLabel(a),
            })),
          ]}
          onChange={(activity) => apply({ activity })}
        />
        <Select
          inline
          pill
          ariaLabel={t("aiFilterModel")}
          value={filters.model ?? ""}
          options={[
            { value: "", label: t("aiAllModels") },
            ...options.models.map((m) => ({ value: m, label: m })),
          ]}
          onChange={(model) => apply({ model })}
        />
        <Select
          inline
          pill
          ariaLabel={t("aiFilterUser")}
          value={filters.user ?? ""}
          options={[
            { value: "", label: t("aiAllUsers") },
            ...options.users.map((u) => ({ value: u.id, label: u.label })),
          ]}
          onChange={(user) => apply({ user })}
        />
      </FilterBar>

      <TileGrid>
        <StatTile
          label={t("aiTileCalls")}
          value={totals.calls.toLocaleString(locale)}
        />
        <StatTile
          label={t("aiTileInput")}
          value={totals.inputTokens.toLocaleString(locale)}
          hint={t("aiTileInputHint", {
            system: totals.systemTokens.toLocaleString(locale),
            user: totals.userTokens.toLocaleString(locale),
          })}
        />
        <StatTile
          label={t("aiTileOutput")}
          value={totals.outputTokens.toLocaleString(locale)}
          hint={
            audioMinutes > 0
              ? t("aiTileAudioHint", { minutes: audioMinutes })
              : undefined
          }
        />
        <StatTile
          label={t("aiTileCost")}
          value={formatUsd(totals.costUsd)}
          hint={t("aiPricesAsOf", { date: AI_PRICES_AS_OF })}
        />
      </TileGrid>

      <Card aria-labelledby="ai-time-title">
        <CardHead>
          <h2 id="ai-time-title">{t("aiTimeTitle")}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <PillRow role="group" aria-label={t("aiMetricLabel")}>
              {(["tokens", "cost", "calls"] as const).map((value) => (
                <Pill
                  key={value}
                  type="button"
                  $active={metric === value}
                  aria-pressed={metric === value}
                  onClick={() => setMetric(value)}
                >
                  {t(`aiMetrics.${value}` as never)}
                </Pill>
              ))}
            </PillRow>
            <PillRow role="group" aria-label={t("aiChartKindLabel")}>
              {(["stacked", "area"] as const).map((value) => (
                <Pill
                  key={value}
                  type="button"
                  $active={timeChart === value}
                  aria-pressed={timeChart === value}
                  onClick={() => setTimeChart(value)}
                >
                  {t(`aiChartKinds.${value}` as never)}
                </Pill>
              ))}
            </PillRow>
          </div>
        </CardHead>

        {timeChart === "area" ? (
          <AreaChart
            title={t("aiTimeTitle")}
            series={areaSeries}
            formatValue={formatMetric}
            tableLabel={t("aiTableLabel")}
            dateLabel={t("aiDateLabel")}
            valueLabel={t(`aiMetrics.${metric}` as never)}
            locale={locale}
          />
        ) : (
          <>
            <StackedBars
              data={chartData}
              colorOf={colorOf}
              formatValue={formatMetric}
              labelOf={activityLabel}
              tableLabel={t("aiTableLabel")}
              dateLabel={t("aiDateLabel")}
            />
            <Legend>
              {chartData.keys.map((key) => (
                <li key={key}>
                  <i style={{ background: colorOf(key) }} aria-hidden />
                  {activityLabel(key)}
                </li>
              ))}
            </Legend>
          </>
        )}
      </Card>

      <Card aria-labelledby="ai-breakdown-title">
        <CardHead>
          <h2 id="ai-breakdown-title">{t("aiBreakdownTitle")}</h2>
          <PillRow role="group" aria-label={t("aiMetricLabel")}>
            {(["cost", "tokens"] as const).map((value) => (
              <Pill
                key={value}
                type="button"
                $active={breakdownMetric === value}
                aria-pressed={breakdownMetric === value}
                onClick={() => setBreakdownMetric(value)}
              >
                {t(`aiMetrics.${value}` as never)}
              </Pill>
            ))}
          </PillRow>
        </CardHead>

        <div
          style={{
            display: "grid",
            gap: "1.5rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <HBarList
            title={t("aiByActivity")}
            emptyLabel={t("aiEmpty")}
            items={byActivity.map((group) => ({
              label: `${activityLabel(group.key)} (${group.totals.calls}×)`,
              value: breakdownValue(group),
              display: breakdownDisplay(group),
              color: colorOf(group.key),
            }))}
          />
          <HBarList
            title={t("aiByModel")}
            emptyLabel={t("aiEmpty")}
            items={byModel.map((group) => ({
              label: group.key,
              value: breakdownValue(group),
              display: breakdownDisplay(group),
            }))}
          />
          <HBarList
            title={t("aiByUser")}
            emptyLabel={t("aiEmpty")}
            items={topGroupsWithRest(byUser, 10, t("aiOtherUsers")).map(
              (group) => ({
                label:
                  (group as LabeledGroup).label ??
                  (group.key === t("aiOtherUsers") ? group.key : group.key),
                value: breakdownValue(group),
                display: breakdownDisplay(group),
              })
            )}
          />
        </div>
      </Card>

      <PriceNote>
        {t("aiPricesNote", { date: AI_PRICES_AS_OF })}{" "}
        {Object.entries(AI_MODEL_PRICES)
          .map(([model, price]) => {
            const parts = [
              price.inputPerM > 0 ? `$${price.inputPerM}/1M in` : null,
              price.outputPerM > 0 ? `$${price.outputPerM}/1M out` : null,
              price.perAudioMinute
                ? `$${price.perAudioMinute}/min`
                : null,
            ].filter(Boolean);
            return `${model}: ${parts.join(" · ")}`;
          })
          .join(" — ")}
      </PriceNote>
    </div>
  );
}
