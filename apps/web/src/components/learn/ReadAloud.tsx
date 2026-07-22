"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";
import { Select } from "@/components/ui/Select";
import type { TtsChunk } from "@/lib/tts";
import { aiGeneratedProps } from "@/lib/ai-marking";

const Controls = styled.div`
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
`;

const PlayerButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.95rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.85rem;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? "rgba(200, 255, 77, 0.45)" : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : theme.colors.bgElevated};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.textMuted};
  transition: color 140ms ease, border-color 140ms ease;

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.6;
  }

  svg {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const bounce = keyframes`
  0%, 100% { transform: scaleY(0.35); }
  50% { transform: scaleY(1); }
`;

/* Mini-Equalizer wie im Audio-Player – zeigt "läuft gerade" */
const Equalizer = styled.span<{ $playing: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 14px;

  span {
    width: 3px;
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(
      to top,
      ${({ theme }) => theme.colors.violet},
      ${({ theme }) => theme.colors.accent}
    );
    transform: scaleY(0.35);
    transform-origin: center;

    ${({ $playing }) =>
      $playing
        ? css`
            animation: ${bounce} 900ms ease-in-out infinite;

            &:nth-child(2) {
              animation-delay: 150ms;
            }
            &:nth-child(3) {
              animation-delay: 300ms;
            }
            &:nth-child(4) {
              animation-delay: 450ms;
            }
          `
        : ""}

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
`;

const RateSelectWrap = styled.div`
  /* kompakte Pill in der Player-Zeile – Trigger-Größe an die Buttons angleichen */
  font-size: 0.85rem;
`;

/* Karaoke-Panel: bricht in der Titelzeile in eine eigene volle Zeile um */
const Panel = styled.div`
  flex-basis: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  padding: 0.9rem 1rem;
  max-height: 280px;
  overflow-y: auto;
  scroll-behavior: smooth;
  font-size: 0.92rem;
  line-height: 2;

  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
`;

/* Identische Optik wie die Karaoke-Transkripte der Audio-/Video-Player */
const Cue = styled.button<{
  $state: "past" | "active" | "future";
  $heading: boolean;
}>`
  display: inline;
  font: inherit;
  line-height: inherit;
  text-align: left;
  padding: 0.14em 0.34em;
  margin-inline-end: 0.12em;
  border-radius: 0.5em;
  cursor: pointer;
  font-weight: ${({ $heading }) => ($heading ? 700 : 400)};
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

const HeadingBreak = styled.span`
  display: block;
  height: 0.5em;
`;

const TTS_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const RATE_STORAGE_KEY = "tts-rate";

/** Sprechpause nach einem Segment (ms, unskaliert) */
function gapAfter(current: TtsChunk, next: TtsChunk | undefined): number {
  if (!next) return 0;
  // vor einer Überschrift: langer Atem; nach einer Überschrift: kurzer
  if (next.kind === "heading") return 900;
  if (current.kind === "heading") return 600;
  return 350;
}

type Segment = TtsChunk & { url?: string };
type Status = "idle" | "loading" | "playing" | "paused";

/**
 * Vorlese-Player für Lektionstexte: Play/Pause/Stopp, Lesegeschwindigkeit,
 * Sprechpausen an Absätzen/Überschriften und Karaoke-Anzeige des aktuellen
 * Segments (gleiche Optik wie die Transkripte der Audio-/Video-Player).
 * Der Server entscheidet den Modus: gecachtes OpenAI-Audio (Bezahl-Abo des
 * Creators) oder Web Speech API (kostenlos) – der Wechsel ist automatisch.
 */
export function ReadAloud({
  lessonId,
  lang,
}: {
  lessonId: string;
  lang: string;
}) {
  const t = useTranslations("learn");
  const [status, setStatus] = useState<Status>("idle");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [index, setIndex] = useState(-1);
  const [rate, setRate] = useState(1);

  const modeRef = useRef<"openai" | "browser">("browser");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gapTimerRef = useRef<number | null>(null);
  /** Nächster Segment-Index, wenn in einer Sprechpause pausiert wurde */
  const pendingNextRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  /** laufende Segment-Anfragen, damit nichts doppelt erzeugt wird */
  const pendingUrlRef = useRef(new Map<number, Promise<void>>());
  const rateRef = useRef(1);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeCueRef = useRef<HTMLButtonElement>(null);

  // gespeicherte Lesegeschwindigkeit übernehmen – localStorage gibt es
  // erst nach der Hydration, deshalb einmalig im Effect
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(RATE_STORAGE_KEY));
    if (TTS_RATES.includes(stored as (typeof TTS_RATES)[number])) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRate(stored);
      rateRef.current = stored;
    }
  }, []);

  /**
   * Chrome beendet lange Äußerungen der Browser-Stimme nach etwa
   * 15 Sekunden stumm – ohne "end"-Ereignis. Zwei Vorkehrungen dagegen:
   * die Segmente sind serverseitig kurz gehalten, und dieser Wächter hält
   * die Sprachausgabe am Leben (pause/resume setzt die interne Uhr
   * zurück). Verstummt sie trotzdem, springt er zum nächsten Segment,
   * damit die Wiedergabe nicht endlos hängen bleibt.
   */
  const keepAliveRef = useRef<number | null>(null);
  const silentTicksRef = useRef(0);

  function clearKeepAlive() {
    if (keepAliveRef.current !== null) {
      window.clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    silentTicksRef.current = 0;
  }

  function startKeepAlive(list: Segment[], i: number) {
    clearKeepAlive();
    keepAliveRef.current = window.setInterval(() => {
      const speech = window.speechSynthesis;
      if (stoppedRef.current) return;
      if (speech.speaking && !speech.paused) {
        speech.pause();
        speech.resume();
        silentTicksRef.current = 0;
        return;
      }
      // Weder sprechend noch pausiert: Der Browser hat die Äußerung
      // verworfen. Nach zwei Durchläufen ohne Lebenszeichen weitergehen.
      if (!speech.speaking && !speech.paused && !speech.pending) {
        silentTicksRef.current += 1;
        if (silentTicksRef.current >= 2) {
          clearKeepAlive();
          scheduleNext(list, i);
        }
      }
    }, 5000);
  }

  function clearGapTimer() {
    if (gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }

  function stop() {
    stoppedRef.current = true;
    clearKeepAlive();
    clearGapTimer();
    pendingNextRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIndex(-1);
    setStatus("idle");
  }

  // Beim Lektionswechsel und Unmount nichts weiterplappern lassen
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stop nutzt nur Refs
  useEffect(() => stop, [lessonId]);

  // Aktives Segment im Panel mittig halten (wie im Karaoke-Transkript)
  useEffect(() => {
    const wrap = panelRef.current;
    const el = activeCueRef.current;
    if (index < 0 || !wrap || !el) return;
    const target = el.offsetTop - wrap.clientHeight / 2 + el.clientHeight / 2;
    wrap.scrollTo({ top: Math.max(0, target) });
  }, [index]);

  function scheduleNext(list: Segment[], i: number) {
    const gap = gapAfter(list[i], list[i + 1]) / rateRef.current;
    if (i + 1 >= list.length) {
      setIndex(-1);
      setStatus("idle");
      return;
    }
    gapTimerRef.current = window.setTimeout(() => {
      gapTimerRef.current = null;
      void playSegment(list, i + 1);
    }, gap);
  }

  /**
   * Audio eines Segments beschaffen, falls es noch nicht existiert.
   *
   * Erzeugt wird erst kurz vor dem Abspielen – wer nach zehn Sekunden
   * abbricht, bezahlt nicht die ganze Lektion. Das Ergebnis wird im
   * Segment vermerkt, damit ein zweiter Durchlauf sofort spielt.
   */
  async function ensureUrl(list: Segment[], i: number): Promise<void> {
    if (modeRef.current !== "openai") return;
    const segment = list[i];
    if (!segment || segment.url) return;
    // Doppelanfragen vermeiden, wenn Vorabholen und Abspielen zusammenfallen
    if (pendingUrlRef.current.has(i)) return pendingUrlRef.current.get(i);

    const request = (async () => {
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, lang, index: i }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { url?: string };
        if (data.url) segment.url = data.url;
      } catch {
        // ohne URL fällt playSegment auf die Browser-Stimme zurück
      } finally {
        pendingUrlRef.current.delete(i);
      }
    })();
    pendingUrlRef.current.set(i, request);
    return request;
  }

  async function playSegment(list: Segment[], i: number) {
    if (stoppedRef.current || i >= list.length) return;
    setIndex(i);

    await ensureUrl(list, i);
    if (stoppedRef.current) return;
    // das folgende Segment im Hintergrund vorbereiten, damit die Pause
    // zwischen zwei Absätzen nicht hörbar länger wird
    if (i + 1 < list.length) void ensureUrl(list, i + 1);

    if (modeRef.current === "openai" && list[i].url) {
      const audio = new Audio(list[i].url);
      audio.playbackRate = rateRef.current;
      audioRef.current = audio;
      audio.onended = () => {
        audioRef.current = null;
        if (!stoppedRef.current) scheduleNext(list, i);
      };
      audio.onerror = () => stop();
      void audio.play().catch(() => stop());
      return;
    }

    const utterance = new SpeechSynthesisUtterance(list[i].text);
    utterance.lang = lang === "de" ? "de-DE" : "en-GB";
    utterance.rate = rateRef.current;
    utterance.onend = () => {
      clearKeepAlive();
      if (!stoppedRef.current) scheduleNext(list, i);
    };
    utterance.onerror = () => {
      clearKeepAlive();
      stop();
    };
    window.speechSynthesis.speak(utterance);
    startKeepAlive(list, i);
  }

  function startFrom(list: Segment[], i: number) {
    stoppedRef.current = false;
    clearGapTimer();
    pendingNextRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("playing");
    void playSegment(list, i);
  }

  async function start() {
    stoppedRef.current = false;
    setStatus("loading");
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, lang }),
      });
      if (!response.ok) throw new Error("tts_failed");
      const data = (await response.json()) as {
        mode: "openai" | "browser";
        segments: Segment[];
      };
      if (stoppedRef.current) return;
      if (data.mode === "browser" && !("speechSynthesis" in window)) {
        setStatus("idle");
        return;
      }
      modeRef.current = data.mode;
      setSegments(data.segments);
      startFrom(data.segments, 0);
    } catch {
      if (!stoppedRef.current) setStatus("idle");
    }
  }

  function pause() {
    // Pause mitten in einer Sprechpause: nächsten Start nur vormerken
    if (gapTimerRef.current !== null) {
      clearGapTimer();
      pendingNextRef.current = index + 1;
    }
    audioRef.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.pause();
    setStatus("paused");
  }

  function resume() {
    stoppedRef.current = false;
    setStatus("playing");
    if (pendingNextRef.current !== null) {
      const next = pendingNextRef.current;
      pendingNextRef.current = null;
      void playSegment(segments, next);
      return;
    }
    if (modeRef.current === "openai") {
      void audioRef.current?.play().catch(() => stop());
    } else if ("speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }
  }

  function changeRate(value: number) {
    setRate(value);
    rateRef.current = value;
    try {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(value));
    } catch {
      // localStorage nicht verfügbar – Tempo gilt nur für diese Sitzung
    }
    // laufendes Audio sofort anpassen; Web Speech übernimmt das Tempo
    // ab dem nächsten Segment (Utterances sind kurz)
    if (audioRef.current) audioRef.current.playbackRate = value;
  }

  const playing = status === "playing";
  const showPanel = (playing || status === "paused") && segments.length > 0;

  return (
    <>
      <Controls>
        <PlayerButton
          type="button"
          $active={playing}
          aria-pressed={playing}
          disabled={status === "loading"}
          onClick={() => {
            if (status === "idle") void start();
            else if (status === "playing") pause();
            else if (status === "paused") resume();
          }}
        >
          {playing ? (
            <Equalizer $playing aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </Equalizer>
          ) : (
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M4.5 2.5 L13 8 L4.5 13.5 Z" />
            </svg>
          )}
          {status === "loading"
            ? t("readAloudLoading")
            : playing
              ? t("readAloudPause")
              : status === "paused"
                ? t("readAloudResume")
                : t("readAloud")}
        </PlayerButton>

        {status === "playing" || status === "paused" ? (
          <PlayerButton type="button" onClick={stop}>
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <rect x="3.5" y="3.5" width="9" height="9" rx="1" />
            </svg>
            {t("readAloudStop")}
          </PlayerButton>
        ) : null}

        <RateSelectWrap>
          <Select
            inline
            pill
            ariaLabel={t("readAloudSpeed")}
            value={String(rate)}
            options={TTS_RATES.map((value) => ({
              value: String(value),
              label: `${value}×`,
            }))}
            onChange={(value) => changeRate(Number(value))}
          />
        </RateSelectWrap>
      </Controls>

      {showPanel ? (
        // Wiedergabe synthetischer (KI-)Stimme → maschinenlesbar markiert
        <Panel ref={panelRef} aria-label={t("readAloud")} {...aiGeneratedProps}>
          {segments.map((segment, i) => {
            const state =
              i === index ? "active" : i < index ? "past" : "future";
            return (
              <span key={i}>
                {segment.kind === "heading" && i > 0 ? <HeadingBreak /> : null}
                <Cue
                  type="button"
                  ref={i === index ? activeCueRef : undefined}
                  $state={index === -1 ? "future" : state}
                  $heading={segment.kind === "heading"}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => startFrom(segments, i)}
                >
                  {segment.text}
                </Cue>
                {segment.kind === "heading" ? <HeadingBreak /> : null}
              </span>
            );
          })}
        </Panel>
      ) : null}
    </>
  );
}
