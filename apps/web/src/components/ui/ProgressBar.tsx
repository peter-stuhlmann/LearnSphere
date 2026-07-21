"use client";

import styled from "styled-components";

const Track = styled.div`
  width: 100%;
  height: 8px;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

const Fill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.violet},
    ${({ theme }) => theme.colors.accent}
  );
  border-radius: inherit;
  transition: width 400ms cubic-bezier(0.22, 1, 0.36, 1);
`;

interface ProgressBarProps {
  percent: number;
  label: string;
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <Track
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <Fill $percent={clamped} />
    </Track>
  );
}
