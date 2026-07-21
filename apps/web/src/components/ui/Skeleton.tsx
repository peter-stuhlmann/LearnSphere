"use client";

import styled, { keyframes } from "styled-components";

/**
 * Skeleton-Bausteine für Ladezustände (loading.tsx der Routen): dezenter
 * Schimmer-Verlauf statt Spinner – die Seite "steht" sofort im richtigen
 * Layout. prefers-reduced-motion stoppt den Schimmer (global abgedeckt).
 */

const shimmer = keyframes`
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
`;

export const Skeleton = styled.div<{
  $w?: string;
  $h?: string;
  $r?: string;
}>`
  width: ${({ $w }) => $w ?? "100%"};
  height: ${({ $h }) => $h ?? "1rem"};
  border-radius: ${({ $r, theme }) => $r ?? theme.radii.md};
  background: linear-gradient(
    100deg,
    ${({ theme }) => theme.colors.bgElevated} 40%,
    ${({ theme }) => theme.colors.surfaceHover} 50%,
    ${({ theme }) => theme.colors.bgElevated} 60%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.6s linear infinite;
`;

/** 16:9-Cover-Fläche, wie in den Kurskarten */
export const SkeletonCover = styled(Skeleton)`
  aspect-ratio: 16 / 9;
  height: auto;
`;

export const SkeletonCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

export const SkeletonGrid = styled.div`
  display: grid;
  gap: 1.25rem;
  margin-top: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;
