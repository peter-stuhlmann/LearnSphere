"use client";

import styled from "styled-components";
import { SERIES_VIOLET } from "./AreaChart";

const Figure = styled.figure`
  margin: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.25rem 1.4rem;
`;

const Caption = styled.figcaption`
  font-size: 0.92rem;
  font-weight: 600;
  margin-bottom: 1rem;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(90px, 180px) 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;

const RowLabel = styled.span`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Track = styled.div`
  height: 12px;
  border-radius: 4px;
  position: relative;
`;

const Fill = styled.div<{ $percent: number; $color?: string }>`
  position: absolute;
  inset: 0 auto 0 0;
  width: ${({ $percent }) => Math.max(0.5, $percent)}%;
  border-radius: 4px;
  background: ${({ $color }) => $color ?? SERIES_VIOLET};
  transition: width 500ms cubic-bezier(0.22, 1, 0.36, 1);
`;

const RowValue = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text};
  white-space: nowrap;
`;

const Empty = styled.p`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

export interface HBarItem {
  label: string;
  value: number;
  display: string;
  color?: string;
}

/**
 * Horizontale Balkenliste (Magnitude, eine Farbe) mit direkten Wert-Labels –
 * dadurch ist die Information nie nur über Farbe/Fläche kodiert.
 */
export function HBarList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: HBarItem[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <Figure>
      <Caption>{title}</Caption>
      {items.length === 0 ? (
        <Empty>{emptyLabel}</Empty>
      ) : (
        items.map((item) => (
          <Row key={item.label} title={`${item.label}: ${item.display}`}>
            <RowLabel>{item.label}</RowLabel>
            <Track>
              <Fill $percent={(item.value / max) * 100} $color={item.color} />
            </Track>
            <RowValue>{item.display}</RowValue>
          </Row>
        ))
      )}
    </Figure>
  );
}
