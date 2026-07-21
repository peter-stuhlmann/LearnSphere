"use client";

import type { ReactNode } from "react";
import styled from "styled-components";

const Tile = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.25rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
`;

const Label = styled.p`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const Value = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: clamp(1.6rem, 3.5vw, 2.3rem);
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.1;

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const Hint = styled.p`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Tile>
      <Label>{label}</Label>
      <Value>{value}</Value>
      {hint ? <Hint>{hint}</Hint> : null}
    </Tile>
  );
}

export const TileGrid = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, 1fr);

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(4, 1fr);
  }
`;
