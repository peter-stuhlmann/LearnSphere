"use client";

import type { ReactNode } from "react";
import styled from "styled-components";
import { motion } from "motion/react";

const Wrap = styled.main`
  min-height: calc(100dvh - 140px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 20px;
`;

const Card = styled(motion.div)`
  width: 100%;
  max-width: 420px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: 2rem 1.5rem;
  backdrop-filter: blur(16px);
  box-shadow: ${({ theme }) => theme.shadows.card};

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: 2.5rem 2.25rem;
  }
`;

const Title = styled.h1`
  font-size: 1.9rem;
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 0.4rem;
  margin-bottom: 1.75rem;
  font-size: 0.94rem;
`;

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Wrap id="main">
      <Card
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <Title>{title}</Title>
        <Subtitle>{subtitle}</Subtitle>
        {children}
      </Card>
    </Wrap>
  );
}

export const FormStack = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
`;

export const FormFooter = styled.p`
  margin-top: 1.5rem;
  font-size: 0.88rem;
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;

  a {
    color: ${({ theme }) => theme.colors.accent};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

export const InlineLink = styled.span`
  font-size: 0.85rem;
  text-align: right;

  a {
    color: ${({ theme }) => theme.colors.textMuted};
    text-decoration: none;

    &:hover {
      color: ${({ theme }) => theme.colors.accent};
    }
  }
`;

export const FormAlert = styled.p<{ $tone: "error" | "success" }>`
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.8rem 1rem;
  font-size: 0.88rem;
  background: ${({ theme, $tone }) =>
    $tone === "error" ? theme.colors.dangerSoft : theme.colors.successSoft};
  color: ${({ theme, $tone }) =>
    $tone === "error" ? theme.colors.danger : theme.colors.success};
`;
