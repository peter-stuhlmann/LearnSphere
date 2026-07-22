"use client";

import styled, { css, keyframes } from "styled-components";

/**
 * Die "Weltall-Ampel" der Prüfung.
 *
 * Dass das Verlassen des Prüfungsfensters gezählt wird, stand bisher nur im
 * Text eines Overlays – man sah es erst, wenn es schon passiert war. Hier
 * wird der Zustand dauerhaft sichtbar: drei Himmelskörper wie an einer
 * Signalstation, von denen immer genau einer brennt.
 *
 * Grün = ruhige Umlaufbahn, Gelb = Signal gestört, Rot = letzte Warnung
 * vor der automatischen Abgabe. Die Ampel ist nie nur Farbe: Jeder Zustand
 * hat zusätzlich ein eigenes Symbol und einen eigenen Text, damit er auch
 * bei Farbfehlsichtigkeit und in Graustufen erkennbar bleibt.
 */

export type SignalLevel = 0 | 1 | 2;

interface Lamp {
  color: string;
  glow: string;
  icon: string;
}

/* Von oben nach unten: alles ruhig → gestört → kritisch */
const LAMPS: Lamp[] = [
  { color: "#4ADE80", glow: "74, 222, 128", icon: "✦" },
  { color: "#F5C542", glow: "245, 197, 66", icon: "◐" },
  { color: "#FF6B6B", glow: "255, 107, 107", icon: "✕" },
];

const orbit = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const breathe = keyframes`
  0%, 100% { opacity: 0.75; transform: scale(1); }
  50%      { opacity: 1;    transform: scale(1.06); }
`;

const Panel = styled.div<{ $large: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ $large }) => ($large ? "1.1rem" : "0.75rem")};
  padding: ${({ $large }) => ($large ? "1rem 1.4rem" : "0.5rem 0.9rem")};
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  /* Sternenstaub im Panel selbst – zwei Punktraster in leicht
     unterschiedlicher Dichte ergeben eine glaubhafte Tiefe. */
  background-color: ${({ theme }) => theme.colors.bgDeep};
  background-image: radial-gradient(
      1px 1px at 18% 30%,
      rgba(255, 255, 255, 0.5),
      transparent
    ),
    radial-gradient(1px 1px at 62% 70%, rgba(255, 255, 255, 0.35), transparent),
    radial-gradient(1px 1px at 84% 22%, rgba(255, 255, 255, 0.45), transparent),
    radial-gradient(
      1.5px 1.5px at 40% 82%,
      rgba(255, 255, 255, 0.25),
      transparent
    );
`;

const Lamps = styled.div<{ $large: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ $large }) => ($large ? "0.85rem" : "0.55rem")};
`;

const Orb = styled.span<{
  $lamp: Lamp;
  $on: boolean;
  $large: boolean;
}>`
  position: relative;
  display: grid;
  place-items: center;
  width: ${({ $large }) => ($large ? "2.4rem" : "1.15rem")};
  height: ${({ $large }) => ($large ? "2.4rem" : "1.15rem")};
  border-radius: 50%;
  font-size: ${({ $large }) => ($large ? "1rem" : "0.5rem")};
  line-height: 1;
  transition: background 320ms ease, box-shadow 320ms ease, opacity 320ms ease;

  ${({ $on, $lamp }) =>
    $on
      ? css`
          /* brennender Himmelskörper: heller Kern, Terminator nach unten
             rechts, plus Korona nach außen */
          background: radial-gradient(
            circle at 34% 30%,
            #fff 0%,
            ${$lamp.color} 42%,
            rgba(0, 0, 0, 0.55) 130%
          );
          color: rgba(10, 12, 20, 0.75);
          box-shadow: 0 0 12px 2px rgba(${$lamp.glow}, 0.65),
            0 0 30px 6px rgba(${$lamp.glow}, 0.28);
          animation: ${breathe} 2.8s ease-in-out infinite;
        `
      : css`
          background: radial-gradient(
            circle at 34% 30%,
            rgba(255, 255, 255, 0.09),
            rgba(255, 255, 255, 0.02) 60%,
            transparent
          );
          color: transparent;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.09);
          opacity: 0.55;
        `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/** Umlaufbahn um den aktiven Körper – nur in der großen Darstellung */
const Ring = styled.span<{ $lamp: Lamp }>`
  position: absolute;
  inset: -0.5rem;
  border-radius: 50%;
  border: 1px solid rgba(${({ $lamp }) => $lamp.glow}, 0.45);
  border-top-color: transparent;
  border-left-color: transparent;
  animation: ${orbit} 4.5s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Text = styled.span<{ $lamp: Lamp; $large: boolean }>`
  display: block;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ $large }) => ($large ? "1rem" : "0.72rem")};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${({ $lamp }) => $lamp.color};

  small {
    display: block;
    margin-top: 0.2rem;
    font-size: ${({ $large }) => ($large ? "0.78rem" : "0.62rem")};
    letter-spacing: 0.06em;
    text-transform: none;
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

export function ExamSignal({
  level,
  label,
  detail,
  large = false,
}: {
  /** 0 = ruhig, 1 = gestört, 2 = letzte Warnung */
  level: SignalLevel;
  label: string;
  /** Zweite Zeile, z. B. wie viele Wechsel noch bleiben */
  detail?: string;
  large?: boolean;
}) {
  const lamp = LAMPS[level];

  return (
    <Panel $large={large}>
      <Lamps $large={large} aria-hidden>
        {LAMPS.map((entry, index) => (
          <Orb
            key={entry.color}
            $lamp={entry}
            $on={index === level}
            $large={large}
          >
            {index === level && large ? <Ring $lamp={entry} /> : null}
            {entry.icon}
          </Orb>
        ))}
      </Lamps>
      <Text $lamp={lamp} $large={large}>
        {label}
        {detail ? <small>{detail}</small> : null}
      </Text>
    </Panel>
  );
}
