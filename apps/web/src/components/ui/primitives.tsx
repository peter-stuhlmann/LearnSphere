"use client";

import styled, { css } from "styled-components";

export const Container = styled.div`
  width: 100%;
  max-width: ${({ theme }) => theme.maxWidth};
  margin-inline: auto;
  padding-inline: 20px;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding-inline: 32px;
  }
`;

export const Kicker = styled.p`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.78rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.accent};
`;

export const SectionTitle = styled.h2`
  font-size: clamp(1.75rem, 5vw, 2.75rem);
  margin-top: 0.5rem;
`;

export const Muted = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
`;

const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-weight: 600;
  font-size: 0.95rem;
  padding: 0.8rem 1.6rem;
  text-decoration: none;
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease,
    color 180ms ease;
  will-change: transform;

  &:active {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const PrimaryButton = styled.button`
  ${buttonBase}
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }
`;

export const GhostButton = styled.button`
  ${buttonBase}
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surfaceHover};
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }
`;

export const DangerButton = styled.button`
  ${buttonBase}
  background: ${({ theme }) => theme.colors.dangerSoft};
  color: ${({ theme }) => theme.colors.danger};
  border: 1px solid transparent;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.danger};
  }
`;

export const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: 1.5rem;
  backdrop-filter: blur(12px);
`;

export const Badge = styled.span<{ $tone?: "accent" | "violet" | "success" | "muted" }>`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  padding: 0.3rem 0.7rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  ${({ theme, $tone = "muted" }) => {
    switch ($tone) {
      case "accent":
        return css`
          background: ${theme.colors.accentSoft};
          color: ${theme.colors.accent};
        `;
      case "violet":
        return css`
          background: ${theme.colors.violetSoft};
          color: ${theme.colors.violet};
        `;
      case "success":
        return css`
          background: ${theme.colors.successSoft};
          color: ${theme.colors.success};
        `;
      default:
        return css`
          background: ${theme.colors.surface};
          color: ${theme.colors.textMuted};
          border: 1px solid ${theme.colors.border};
        `;
    }
  }}
`;

export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
`;
