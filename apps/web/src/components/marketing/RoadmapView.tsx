"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";
import { motion, useScroll, useSpring } from "motion/react";
import { Container, Kicker, Muted, SectionTitle } from "@/components/ui/primitives";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Lead = styled.p`
  max-width: 58ch;
  margin-top: 1rem;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 1.05rem;
`;

const Timeline = styled.div`
  position: relative;
  margin-top: 3.5rem;
  padding-bottom: 1rem;
`;

/* Grundlinie + mit dem Scrollen wachsende Leuchtlinie */
const Track = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 20px;
  width: 2px;
  background: ${({ theme }) => theme.colors.border};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    left: 50%;
    transform: translateX(-50%);
  }
`;

const Progress = styled(motion.div)`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 20px;
  width: 2px;
  transform-origin: top;
  background: linear-gradient(
    180deg,
    ${({ theme }) => theme.colors.accent},
    ${({ theme }) => theme.colors.violet}
  );
  box-shadow: 0 0 18px rgba(200, 255, 77, 0.35);

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    left: calc(50% - 1px);
  }
`;

const Items = styled.ol`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2.25rem;
`;

const Item = styled(motion.li)<{ $side: "left" | "right" }>`
  position: relative;
  padding-left: 52px;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    width: calc(50% - 40px);
    padding-left: 0;

    ${({ $side }) =>
      $side === "left"
        ? css`
            margin-right: auto;
            text-align: right;
          `
        : css`
            margin-left: auto;
          `}
  }
`;

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(200, 255, 77, 0.45); }
  50% { box-shadow: 0 0 0 9px rgba(200, 255, 77, 0); }
`;

const Node = styled.span<{ $status: Status; $side: "left" | "right" }>`
  position: absolute;
  top: 0.4rem;
  left: 12px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 3px solid ${({ theme }) => theme.colors.bg};

  background: ${({ theme, $status }) =>
    $status === "progress"
      ? theme.colors.accent
      : $status === "next"
        ? theme.colors.violet
        : theme.colors.textFaint};

  ${({ $status }) =>
    $status === "progress"
      ? css`
          animation: ${pulse} 2.4s ease-in-out infinite;
        `
      : ""}

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    ${({ $side }) =>
      $side === "left"
        ? css`
            left: auto;
            right: -49px;
          `
        : css`
            left: -49px;
          `}
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const CardBox = styled.div<{ $status: Status }>`
  border: 1px solid
    ${({ theme, $status }) =>
      $status === "progress"
        ? "rgba(200, 255, 77, 0.35)"
        : $status === "next"
          ? "rgba(139, 124, 255, 0.35)"
          : theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.4rem 1.5rem;
  transition: transform 180ms ease, border-color 180ms ease;

  &:hover {
    transform: translateY(-3px);
  }

  h2 {
    font-size: 1.15rem;
    margin-top: 0.6rem;
  }

  p {
    margin-top: 0.5rem;
    font-size: 0.92rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const MetaRow = styled.div<{ $side: "left" | "right" }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    ${({ $side }) =>
      $side === "left"
        ? css`
            justify-content: flex-end;
          `
        : ""}
  }
`;

const StatusBadge = styled.span<{ $status: Status }>`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 0.25rem 0.65rem;
  border-radius: ${({ theme }) => theme.radii.pill};

  ${({ theme, $status }) =>
    $status === "progress"
      ? css`
          color: ${theme.colors.accent};
          background: ${theme.colors.accentSoft};
          border: 1px solid rgba(200, 255, 77, 0.4);
        `
      : $status === "next"
        ? css`
            color: ${theme.colors.violet};
            background: ${theme.colors.violetSoft};
            border: 1px solid rgba(139, 124, 255, 0.4);
          `
        : css`
            color: ${theme.colors.textMuted};
            background: ${theme.colors.surface};
            border: 1px solid ${theme.colors.borderStrong};
          `}
`;

const Quarter = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

type Status = "progress" | "next" | "planned";

const ITEMS: { key: string; status: Status; quarter: string }[] = [
  { key: "r1", status: "progress", quarter: "Q3 2026" },
  { key: "r2", status: "progress", quarter: "Q3 2026" },
  { key: "r3", status: "next", quarter: "Q4 2026" },
  { key: "r4", status: "next", quarter: "Q4 2026" },
  { key: "r5", status: "planned", quarter: "Q1 2027" },
  { key: "r6", status: "planned", quarter: "Q1 2027" },
  { key: "r7", status: "planned", quarter: "2027" },
  { key: "r8", status: "planned", quarter: "2027" },
];

export function RoadmapView() {
  const t = useTranslations("roadmap");
  const timelineRef = useRef<HTMLDivElement>(null);

  // Leuchtlinie wächst mit dem Scrollfortschritt durch die Timeline
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 75%", "end 60%"],
  });
  const lineScale = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
  });

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <Lead>{t("lead")}</Lead>

        <Timeline ref={timelineRef}>
          <Track aria-hidden="true" />
          <Progress aria-hidden="true" style={{ scaleY: lineScale }} />

          <Items>
            {ITEMS.map((item, i) => {
              const side = i % 2 === 0 ? "right" : "left";
              return (
                <Item
                  key={item.key}
                  $side={side}
                  initial={{ opacity: 0, y: 32, scale: 0.97 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{
                    duration: 0.55,
                    delay: (i % 2) * 0.08,
                    ease: [0.21, 0.8, 0.35, 1],
                  }}
                >
                  <Node $status={item.status} $side={side} aria-hidden="true" />
                  <CardBox $status={item.status}>
                    <MetaRow $side={side}>
                      <StatusBadge $status={item.status}>
                        {item.status === "progress"
                          ? t("statusProgress")
                          : item.status === "next"
                            ? t("statusNext")
                            : t("statusPlanned")}
                      </StatusBadge>
                      <Quarter>{item.quarter}</Quarter>
                    </MetaRow>
                    <h2>{t(`${item.key}Title` as never)}</h2>
                    <p>{t(`${item.key}Text` as never)}</p>
                  </CardBox>
                </Item>
              );
            })}
          </Items>
        </Timeline>

        <Muted
          style={{ marginTop: "3rem", fontSize: "0.9rem", textAlign: "center" }}
        >
          {t("disclaimer")}
        </Muted>
      </Container>
    </Wrap>
  );
}
