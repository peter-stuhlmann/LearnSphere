"use client";

import { useId } from "react";
import styled from "styled-components";

const Svg = styled.svg`
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
  background: ${({ theme }) => theme.colors.bgElevated};
`;

/**
 * Dezenter 16:9-Bildplatzhalter für Kurse ohne Cover (z. B. Entwürfe):
 * Bild-Glyphe (Rahmen, Sonne, Berge) mit Lime-Violett-Verlauf auf einem
 * weichen Glow. Rein dekorativ (aria-hidden), IDs pro Instanz eindeutig.
 */
export function CoverPlaceholder() {
  const uid = useId();
  const stroke = `${uid}-stroke`;
  const glow = `${uid}-glow`;

  return (
    <Svg viewBox="0 0 992 558" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={stroke} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C8FF4D" stopOpacity="0.65" />
          <stop offset="1" stopColor="#8B7CFF" stopOpacity="0.65" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#8B7CFF" stopOpacity="0.14" />
          <stop offset="1" stopColor="#8B7CFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="992" height="558" fill={`url(#${glow})`} />

      <g
        stroke={`url(#${stroke})`}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Bilderrahmen */}
        <rect x="394" y="197" width="204" height="164" rx="20" />
        {/* Sonne */}
        <circle cx="452" cy="251" r="16" />
        {/* Bergsilhouette, am Rahmen entlang */}
        <path d="M410 337 L470 273 L508 313 L538 281 L582 329" />
      </g>
    </Svg>
  );
}
