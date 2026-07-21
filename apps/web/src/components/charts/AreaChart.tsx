"use client";

import { useId, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import type { DailyPoint } from "@elearning/core/stats";

/** Validierte Serienfarbe auf dunkler Fläche (dataviz-Palette). */
export const SERIES_VIOLET = "#8B7CFF";

const Figure = styled.figure`
  margin: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.25rem 1.4rem 0.9rem;
`;

const Caption = styled.figcaption`
  font-size: 0.92rem;
  font-weight: 600;
  margin-bottom: 0.9rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;

  span.total {
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const SvgWrap = styled.div`
  position: relative;
`;

const Tooltip = styled.div`
  position: absolute;
  pointer-events: none;
  transform: translate(-50%, -110%);
  background: ${({ theme }) => theme.colors.bgDeep};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.sm};
  padding: 0.4rem 0.6rem;
  font-size: 0.75rem;
  white-space: nowrap;
  box-shadow: ${({ theme }) => theme.shadows.card};

  strong {
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.text};
  }

  span {
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const TableDetails = styled.details`
  margin-top: 0.5rem;
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textFaint};

  summary {
    cursor: pointer;

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  }

  table {
    margin-top: 0.5rem;
    border-collapse: collapse;
    width: 100%;
    max-height: 200px;
  }

  td,
  th {
    text-align: left;
    padding: 0.2rem 0.5rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-weight: 400;
  }
`;

const WIDTH = 640;
const HEIGHT = 200;
const PAD_X = 6;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

interface AreaChartProps {
  title: string;
  series: DailyPoint[];
  formatValue: (value: number) => string;
  totalLabel?: string;
  tableLabel: string;
  dateLabel: string;
  valueLabel: string;
  locale: string;
}

export function AreaChart({
  title,
  series,
  formatValue,
  totalLabel,
  tableLabel,
  dateLabel,
  valueLabel,
  locale,
}: AreaChartProps) {
  const gradientId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...series.map((p) => p.value));
  const total = series.reduce((sum, p) => sum + p.value, 0);

  const points = useMemo(() => {
    const innerWidth = WIDTH - PAD_X * 2;
    const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const step = series.length > 1 ? innerWidth / (series.length - 1) : 0;
    return series.map((point, i) => ({
      ...point,
      x: PAD_X + (series.length > 1 ? i * step : innerWidth / 2),
      y: PAD_TOP + innerHeight * (1 - point.value / max),
    }));
  }, [series, max]);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} L${points[0].x.toFixed(1)},${HEIGHT - PAD_BOTTOM} Z`
    : "";

  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  });

  function onMove(event: React.MouseEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < nearestDist) {
        nearest = i;
        nearestDist = dist;
      }
    });
    setHover(nearest);
  }

  const hovered = hover !== null ? points[hover] : null;

  return (
    <Figure>
      <Caption>
        {title}
        {totalLabel ? <span className="total">{totalLabel}</span> : null}
      </Caption>
      <SvgWrap ref={wrapRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${title}: ${totalLabel ?? formatValue(total)}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_VIOLET} stopOpacity={0.35} />
              <stop offset="100%" stopColor={SERIES_VIOLET} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Grundlinie */}
          <line
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={HEIGHT - PAD_BOTTOM}
            y2={HEIGHT - PAD_BOTTOM}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
          />

          {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke={SERIES_VIOLET}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {/* Erste/letzte Datumsbeschriftung */}
          {points.length > 0 ? (
            <>
              <text
                x={PAD_X}
                y={HEIGHT - 6}
                fill="rgba(255,255,255,0.4)"
                fontSize={10}
              >
                {dateFormat.format(new Date(points[0].date))}
              </text>
              <text
                x={WIDTH - PAD_X}
                y={HEIGHT - 6}
                fill="rgba(255,255,255,0.4)"
                fontSize={10}
                textAnchor="end"
              >
                {dateFormat.format(new Date(points[points.length - 1].date))}
              </text>
            </>
          ) : null}

          {/* Crosshair + Punkt */}
          {hovered ? (
            <>
              <line
                x1={hovered.x}
                x2={hovered.x}
                y1={PAD_TOP}
                y2={HEIGHT - PAD_BOTTOM}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={hovered.x}
                cy={hovered.y}
                r={4.5}
                fill={SERIES_VIOLET}
                stroke="#12141F"
                strokeWidth={2}
              />
            </>
          ) : null}
        </svg>

        {hovered ? (
          <Tooltip
            style={{
              left: `${(hovered.x / WIDTH) * 100}%`,
              top: `${(hovered.y / HEIGHT) * 100}%`,
            }}
          >
            <strong>{formatValue(hovered.value)}</strong>{" "}
            <span>{dateFormat.format(new Date(hovered.date))}</span>
          </Tooltip>
        ) : null}
      </SvgWrap>

      <TableDetails>
        <summary>{tableLabel}</summary>
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th scope="col">{dateLabel}</th>
                <th scope="col">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{formatValue(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableDetails>
    </Figure>
  );
}
