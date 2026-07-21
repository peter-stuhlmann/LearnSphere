"use client";

import { Fragment, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import type { TranscriptCue } from "@elearning/core/blocks";
import { formatDuration } from "@elearning/core/format";

const Wrap = styled.div`
  position: relative;
  padding: 0.9rem 1rem;
  max-height: 360px;
  overflow-y: auto;
  scroll-behavior: smooth;
  font-size: 0.92rem;
  line-height: 2;

  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
`;

const Hint = styled.p`
  margin-bottom: 0.65rem;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const Cue = styled.button<{ $state: "past" | "active" | "future" }>`
  display: inline;
  font: inherit;
  line-height: inherit;
  text-align: left;
  padding: 0.14em 0.34em;
  margin-inline-end: 0.12em;
  border-radius: 0.5em;
  cursor: pointer;
  /* box-decoration-break: Highlight umbricht sauber über Zeilen */
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  transition: background 220ms ease, color 220ms ease, box-shadow 220ms ease;

  color: ${({ theme, $state }) =>
    $state === "active"
      ? theme.colors.text
      : $state === "past"
        ? theme.colors.textFaint
        : theme.colors.textMuted};

  background: ${({ theme, $state }) =>
    $state === "active"
      ? `linear-gradient(120deg,
          color-mix(in srgb, ${theme.colors.accent} 22%, transparent),
          color-mix(in srgb, ${theme.colors.violet} 26%, transparent))`
      : "transparent"};

  box-shadow: ${({ theme, $state }) =>
    $state === "active"
      ? `inset 0 0 0 1px color-mix(in srgb, ${theme.colors.accent} 35%, transparent),
         0 0 16px color-mix(in srgb, ${theme.colors.accent} 18%, transparent)`
      : "none"};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

/** Sprecherwechsel-Label ("Person 1", "Person 2"), zwei alternierende Töne */
const SpeakerRow = styled.div<{ $alt: boolean }>`
  margin: 0.9em 0 0.2em;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme, $alt }) =>
    $alt ? theme.colors.violet : theme.colors.accent};

  &:first-child {
    margin-top: 0;
  }
`;

/**
 * Anzeigename eines Sprechers: Nummern werden lokalisiert ("Person 1"),
 * vom Creator vergebene Namen erscheinen unverändert.
 */
export function speakerDisplayName(
  speaker: string,
  t: (key: "speaker", values: { n: string }) => string
): string {
  return /^\d+$/.test(speaker) ? t("speaker", { n: speaker }) : speaker;
}

/**
 * Aktives Segment zur Abspielzeit: das zuletzt gestartete Segment, solange
 * die Zeit nicht deutlich hinter seinem Ende liegt (kleine Lücken zwischen
 * Whisper-Segmenten überbrücken wir mit etwas Kulanz). Wird auch vom
 * Video-Player für die Untertitel-Einblendung genutzt.
 */
export function activeCueIndex(cues: TranscriptCue[], time: number): number {
  let candidate = -1;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start <= time) candidate = i;
    else break;
  }
  if (candidate === -1) return -1;
  return time <= cues[candidate].end + 1.5 ? candidate : -1;
}

interface KaraokeTranscriptProps {
  cues: TranscriptCue[];
  locale: string;
  /** aktuelle Abspielzeit in Sekunden */
  time: number;
  /** springt im Medium an die Stelle (und spielt weiter) */
  onSeek: (seconds: number) => void;
}

/**
 * Karaoke-Transkript: Das gerade gesprochene Segment wird beim Abspielen
 * hervorgehoben und mitgescrollt; Klick auf einen Satz springt im
 * Video/Audio dorthin.
 */
export function KaraokeTranscript({
  cues,
  locale,
  time,
  onSeek,
}: KaraokeTranscriptProps) {
  const t = useTranslations("learn");
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const active = activeCueIndex(cues, time);

  // Sprecher in Auftritts-Reihenfolge – bestimmt die alternierende Farbe
  const speakerOrder: string[] = [];
  for (const cue of cues) {
    if (cue.speaker && !speakerOrder.includes(cue.speaker)) {
      speakerOrder.push(cue.speaker);
    }
  }

  // Aktives Segment im (eigenen!) Scrollbereich mittig halten –
  // bewusst nicht scrollIntoView, damit die Seite selbst nie mitscrollt
  useEffect(() => {
    const wrap = wrapRef.current;
    const el = activeRef.current;
    if (active < 0 || !wrap || !el) return;
    const target =
      el.offsetTop - wrap.clientHeight / 2 + el.clientHeight / 2;
    wrap.scrollTo({ top: Math.max(0, target) });
  }, [active]);

  return (
    <Wrap ref={wrapRef}>
      <Hint>✨ {t("transcriptClickHint")}</Hint>
      <div>
        {cues.map((cue, i) => {
          const text =
            locale === "en" ? cue.en || cue.de : cue.de || cue.en;
          if (!text) return null;
          const state =
            i === active ? "active" : cue.end <= time ? "past" : "future";
          // Sprecherwechsel als eigene Zeile markieren (Diarization)
          const speakerChanged =
            cue.speaker !== "" && cue.speaker !== cues[i - 1]?.speaker;
          return (
            <Fragment key={`${cue.start}-${i}`}>
              {speakerChanged ? (
                <SpeakerRow $alt={speakerOrder.indexOf(cue.speaker) % 2 === 1}>
                  {speakerDisplayName(cue.speaker, t)}
                </SpeakerRow>
              ) : null}
              <Cue
                type="button"
                ref={i === active ? activeRef : undefined}
                $state={state}
                aria-current={i === active ? "true" : undefined}
                title={formatDuration(cue.start)}
                onClick={() => onSeek(cue.start)}
              >
                {text}
              </Cue>
            </Fragment>
          );
        })}
      </div>
    </Wrap>
  );
}
