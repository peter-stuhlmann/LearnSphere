"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styled, { keyframes } from "styled-components";
import { PrimaryButton, GhostButton } from "@/components/ui/primitives";

const rise = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, 1rem);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
`;

/* Schwebt mittig unten – über dem Fokus-Layer (z-index 80). */
const Card = styled.section`
  position: fixed;
  left: 50%;
  bottom: max(1.25rem, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 85;
  width: min(30rem, calc(100vw - 2rem));
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background:
    radial-gradient(
      circle at 0% 0%,
      rgba(200, 255, 77, 0.1),
      transparent 60%
    ),
    ${({ theme }) => theme.colors.bgElevated};
  box-shadow: ${({ theme }) => theme.shadows.card};
  animation: ${rise} 260ms ease;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Ring = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 52px;

  svg {
    transform: rotate(-90deg);
  }

  .track {
    stroke: ${({ theme }) => theme.colors.border};
  }

  .fill {
    stroke: ${({ theme }) => theme.colors.accent};
    stroke-linecap: round;
    transition: stroke-dashoffset 1s linear;
  }

  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }

  span {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 1rem;
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const Text = styled.div`
  flex: 1;
  min-width: 0;

  p.kicker {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: ${({ theme }) => theme.colors.accent};
    margin-bottom: 0.15rem;
  }

  p.title {
    font-weight: 600;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-shrink: 0;

  button {
    padding: 0.4rem 0.9rem;
    font-size: 0.82rem;
  }
`;

const R = 24;
const CIRC = 2 * Math.PI * R;

/**
 * „Als Nächstes"-Countdown: startet nach dem Abschluss einer Lektion und
 * springt nach Ablauf automatisch weiter. Pausiert bei Hover/Fokus (damit
 * niemand gehetzt wird) und ist jederzeit über „Bleiben" abbrechbar –
 * erfüllt so WCAG 2.2.1 (Timing anpassbar).
 */
export function UpNextCountdown({
  title,
  seconds = 6,
  onAdvance,
  onCancel,
}: {
  title: string;
  seconds?: number;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("learn");
  const [remaining, setRemaining] = useState(seconds);
  const [paused, setPaused] = useState(false);
  const advancedRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    if (remaining <= 0) {
      if (!advancedRef.current) {
        advancedRef.current = true;
        onAdvance();
      }
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, paused, onAdvance]);

  const offset = CIRC * (1 - Math.max(0, remaining) / seconds);

  return (
    <Card
      aria-label={t("upNextLabel")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Ring aria-hidden>
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle className="track" cx="26" cy="26" r={R} fill="none" strokeWidth="4" />
          <circle
            className="fill"
            cx="26"
            cy="26"
            r={R}
            fill="none"
            strokeWidth="4"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
          />
        </svg>
        <span>{Math.max(0, remaining)}</span>
      </Ring>

      <Text>
        <p className="kicker">▶ {t("upNextLabel")}</p>
        <p className="title">{title}</p>
      </Text>

      <Actions>
        <PrimaryButton type="button" onClick={onAdvance}>
          {t("advanceNow")}
        </PrimaryButton>
        <GhostButton type="button" onClick={onCancel}>
          {t("stayHere")}
        </GhostButton>
      </Actions>
    </Card>
  );
}
