"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import type { TranscriptCue } from "@elearning/core/blocks";
import {
  activeChapterAt,
  formatChapterTime,
  type Chapter,
} from "@elearning/core/chapters";
import { heatAreaPath } from "@elearning/core/heatmap";
import { formatDuration } from "@elearning/core/format";
import { activeCueIndex, speakerDisplayName } from "./KaraokeTranscript";

/**
 * Eigener Video-Player im LearnSphere-Look: Overlay-Controls mit
 * Verlaufs-Seekbar, großem Play-Puls, Tempo, Lautstärke, Vollbild – und
 * optionalen Untertiteln direkt aus den Transkript-Cues (CC-Toggle).
 * Controls blenden bei laufender Wiedergabe nach kurzer Ruhe aus.
 */

const Shell = styled.div<{ $theater: boolean }>`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: ${({ theme }) => theme.radii.lg};
  overflow: hidden;
  background: #000;
  border: 1px solid ${({ theme }) => theme.colors.border};

  ${({ $theater, theme }) =>
    $theater
      ? `
    /* Kinomodus: groß zentriert über der abgedunkelten Seite */
    position: fixed;
    inset: 0;
    margin: auto;
    z-index: 71;
    width: min(94vw, 168vh);
    height: auto;
    border-color: ${theme.colors.borderStrong};
    box-shadow: 0 30px 120px rgba(0, 0, 0, 0.8);
  `
      : ""}

  &:fullscreen {
    aspect-ratio: auto;
    border-radius: 0;
    border: 0;
  }
`;

const TheaterBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(4, 5, 10, 0.88);
  backdrop-filter: blur(6px);
`;

const StyledVideo = styled.video`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: pointer;
`;

/** Großer Play-Impuls in der Mitte, solange pausiert */
const CenterPlay = styled.button`
  position: absolute;
  inset: 0;
  margin: auto;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.onAccent};
  background:
    linear-gradient(${({ theme }) => theme.colors.accent}, ${({ theme }) =>
      theme.colors.accent}) padding-box,
    linear-gradient(135deg, ${({ theme }) => theme.colors.violet}, ${({
      theme,
    }) => theme.colors.accent}) border-box;
  border: 2px solid transparent;
  box-shadow: ${({ theme }) => theme.shadows.glow};
  transition: transform 160ms ease;

  &:hover {
    transform: scale(1.08);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 3px;
  }

  svg {
    width: 26px;
    height: 26px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/** Dunkler Verlauf hinter den Controls, damit sie auf jedem Bild lesbar sind */
const Scrim = styled.div<{ $visible: boolean }>`
  position: absolute;
  inset: auto 0 0;
  height: 8.5rem;
  background: linear-gradient(to top, rgba(4, 5, 10, 0.85), transparent);
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: opacity 250ms ease;
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Bar = styled.div<{ $visible: boolean }>`
  position: absolute;
  inset: auto 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.7rem 0.9rem 0.8rem;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: ${({ $visible }) => ($visible ? "auto" : "none")};
  transition: opacity 250ms ease;

  /* Tastatur-Fokus hält die Controls immer sichtbar */
  &:focus-within {
    opacity: 1;
    pointer-events: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Seek = styled.input<{ $percent: number }>`
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  cursor: pointer;
  background: linear-gradient(
    to right,
    ${({ theme }) => theme.colors.violet} 0%,
    ${({ theme }) => theme.colors.accent} ${({ $percent }) => $percent}%,
    rgba(255, 255, 255, 0.22) ${({ $percent }) => $percent}%
  );

  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.text};
    border: 2px solid ${({ theme }) => theme.colors.accent};
    box-shadow: 0 0 12px rgba(200, 255, 77, 0.5);
    transition: transform 120ms ease;
  }

  &::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.text};
    border: 2px solid ${({ theme }) => theme.colors.accent};
    box-shadow: 0 0 12px rgba(200, 255, 77, 0.5);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 3px;
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
`;

/* ---------- Kapitelmarker ---------- */

const SeekWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

/* "Oft geschaut"-Kurve über der Seekbar (wie YouTubes "Most replayed") */
const HeatCurve = styled.svg`
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 2px);
  width: 100%;
  height: 22px;
  pointer-events: none;
  opacity: 0.85;

  path {
    fill: rgba(200, 255, 77, 0.28);
    stroke: rgba(200, 255, 77, 0.55);
    stroke-width: 0.6;
  }
`;

/* Dunkle Ticks auf der Seekbar (wie YouTube-Kapitel) */
const ChapterTick = styled.span<{ $percent: number }>`
  position: absolute;
  left: ${({ $percent }) => $percent}%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background: rgba(7, 8, 15, 0.8);
  pointer-events: none;
`;

const ChapterName = styled.span`
  max-width: 26ch;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: ${({ theme }) => theme.colors.accent};

  @media (max-width: 519px) {
    display: none;
  }
`;

const ChapterMenu = styled.div`
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 84px;
  z-index: 5;
  max-height: min(50%, 260px);
  overflow-y: auto;
  padding: 0.4rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: rgba(7, 8, 15, 0.94);
  backdrop-filter: blur(10px);
`;

const ChapterItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  width: 100%;
  text-align: left;
  padding: 0.45rem 0.6rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  font-size: 0.85rem;
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.text};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : "transparent"};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }

  span.time {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
  }
`;

const RoundButton = styled.button<{ $active?: boolean }>`
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : "rgba(255, 255, 255, 0.88)"};
  background: ${({ $active }) =>
    $active ? "rgba(200, 255, 77, 0.16)" : "transparent"};

  &:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const CcButton = styled(RoundButton)`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
`;

const SpeedButton = styled.button`
  flex-shrink: 0;
  min-width: 48px;
  height: 30px;
  padding-inline: 0.55rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.88);

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const TimeText = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.74rem;
  color: rgba(255, 255, 255, 0.82);
  white-space: nowrap;
`;

const Spacer = styled.span`
  flex: 1;
`;

const Volume = styled.input<{ $percent: number }>`
  appearance: none;
  width: 72px;
  height: 5px;
  border-radius: 999px;
  cursor: pointer;
  background: linear-gradient(
    to right,
    ${({ theme }) => theme.colors.accent} ${({ $percent }) => $percent}%,
    rgba(255, 255, 255, 0.22) ${({ $percent }) => $percent}%
  );

  &::-webkit-slider-thumb {
    appearance: none;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.text};
    border: 2px solid ${({ theme }) => theme.colors.accent};
  }

  &::-moz-range-thumb {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.text};
    border: 2px solid ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 3px;
  }

  @media (max-width: 519px) {
    display: none;
  }
`;

/** Untertitel-Zeile aus den Transkript-Cues */
const Caption = styled.p<{ $lifted: boolean }>`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: ${({ $lifted }) => ($lifted ? "5.6rem" : "1.1rem")};
  transition: bottom 250ms ease;
  max-width: min(88%, 60ch);
  padding: 0.4rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(4, 5, 10, 0.78);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: clamp(0.85rem, 2.4vw, 1.05rem);
  line-height: 1.5;
  text-align: center;
  text-wrap: balance;
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

const PlayIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5.5a1 1 0 0 1 1.53-.85l10 6.5a1 1 0 0 1 0 1.7l-10 6.5A1 1 0 0 1 8 18.5v-13z" />
  </svg>
);

const PauseIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

interface VideoPlayerProps {
  src: string;
  title: string;
  cues?: TranscriptCue[];
  /** Vorschaubild, bis die Wiedergabe startet */
  poster?: string;
  /**
   * Bekannte Dauer aus der Datenbank (Sekunden). Dient als Anzeige-Fallback,
   * solange der Browser die Metadaten-Dauer noch nicht kennt – manche
   * Dateien melden sie erst spät oder als Infinity (moov-Atom am Dateiende).
   */
  fallbackDuration?: number;
  /** gemerkte Abspielposition: dort fortsetzen (0 = regulär von vorn) */
  startAt?: number;
  /** Kapitelmarker: Ticks in der Timeline + Kapitelliste */
  chapters?: Chapter[];
  /** "Oft geschaut"-Kurve über der Seekbar (null = zu wenig Daten) */
  heat?: number[] | null;
  onTime?: (seconds: number) => void;
  onPause?: (seconds: number) => void;
  onEnded?: () => void;
  /** erlaubt dem Karaoke-Transkript, von außen zu springen (+ Play) */
  seekRef?: React.RefObject<((seconds: number) => void) | null>;
}

export function VideoPlayer({
  src,
  title,
  cues = [],
  poster,
  fallbackDuration = 0,
  startAt = 0,
  chapters = [],
  heat = null,
  onTime,
  onPause,
  onEnded,
  seekRef,
}: VideoPlayerProps) {
  const t = useTranslations("learn");
  const locale = useLocale();
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | null>(null);
  /** startAt nur beim ersten Metadaten-Load anwenden */
  const resumedRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() =>
    fallbackDuration > 0 ? fallbackDuration : 0
  );

  /** Präzise Browser-Dauer übernehmen, sobald sie (endlich) bekannt ist */
  function refreshDuration() {
    const mediaDuration = videoRef.current?.duration;
    if (
      typeof mediaDuration === "number" &&
      Number.isFinite(mediaDuration) &&
      mediaDuration > 0
    ) {
      setDuration(mediaDuration);
    }
  }

  /* Gemerkte Position ansteuern. Als Effect statt nur onLoadedMetadata:
     Bei gecachten Dateien feuert loadedmetadata, BEVOR React den Handler
     angehängt hat – dann greift hier der readyState-Zweig. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || resumedRef.current || startAt <= 0) return;
    const applyResume = () => {
      if (resumedRef.current) return;
      resumedRef.current = true;
      if (!Number.isFinite(video.duration) || startAt < video.duration) {
        video.currentTime = startAt;
        setCurrentTime(startAt);
      }
    };
    if (video.readyState >= 1) {
      applyResume();
      return;
    }
    video.addEventListener("loadedmetadata", applyResume, { once: true });
    return () => video.removeEventListener("loadedmetadata", applyResume);
  }, [startAt]);

  const [chapterMenuOpen, setChapterMenuOpen] = useState(false);
  const activeChapter = activeChapterAt(chapters, currentTime);

  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [captions, setCaptions] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [idle, setIdle] = useState(false);

  const controlsVisible = !playing || !idle;
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const hasCaptions = cues.some((cue) => cue.de || cue.en);
  const activeCue = captions ? activeCueIndex(cues, currentTime) : -1;
  let captionText = "";
  if (activeCue >= 0) {
    const cue = cues[activeCue];
    captionText = locale === "en" ? cue.en || cue.de : cue.de || cue.en;
    // bei Gesprächen den Sprecher voranstellen
    if (captionText && cue.speaker) {
      captionText = `${speakerDisplayName(cue.speaker, t)}: ${captionText}`;
    }
  }

  /** Interaktion hält die Controls wach; nach 2,6 s Ruhe blenden sie aus */
  function poke() {
    setIdle(false);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setIdle(true), 2_600);
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  // Vollbild-Zustand mitverfolgen (auch bei Esc)
  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === shellRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Kinomodus: Esc beendet ihn, die Seite dahinter scrollt nicht mit
  useEffect(() => {
    if (!theater) return;
    function onKeyDown(event: KeyboardEvent) {
      // im nativen Vollbild gehört Esc dem Browser
      if (event.key === "Escape" && !document.fullscreenElement) {
        setTheater(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [theater]);

  // externen Seek-Zugriff bereitstellen (Karaoke-Transkript)
  useEffect(() => {
    if (!seekRef) return;
    seekRef.current = (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = seconds;
      setCurrentTime(seconds);
      void video.play();
    };
    return () => {
      seekRef.current = null;
    };
  }, [seekRef]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
    poke();
  }

  function seek(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setCurrentTime(seconds);
    poke();
  }

  function changeVolume(next: number) {
    setVolume(next);
    if (next > 0) setMuted(false);
    if (videoRef.current) videoRef.current.volume = next;
  }

  function cycleRate() {
    const index = PLAYBACK_RATES.indexOf(
      rate as (typeof PLAYBACK_RATES)[number]
    );
    const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
    setRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void shellRef.current?.requestFullscreen?.().catch(() => {});
    }
  }

  return (
    <>
      {theater ? (
        <TheaterBackdrop aria-hidden="true" onClick={() => setTheater(false)} />
      ) : null}
    <Shell
      ref={shellRef}
      $theater={theater}
      role="group"
      aria-label={title}
      onPointerMove={poke}
      onPointerDown={poke}
    >
      {/* Untertitel laufen über die eigenen CC-Controls (Cues), kein <track> */}
      <StyledVideo
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        preload="metadata"
        muted={muted}
        // Download-Hürden: kein Download-Menü, kein PiP, kein Kontextmenü
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          poke();
        }}
        onPause={() => {
          setPlaying(false);
          onPause?.(videoRef.current?.currentTime ?? 0);
        }}
        onEnded={() => {
          setPlaying(false);
          onEnded?.();
        }}
        onTimeUpdate={() => {
          const time = videoRef.current?.currentTime ?? 0;
          setCurrentTime(time);
          onTime?.(time);
          // manche Dateien liefern die Dauer erst während der Wiedergabe
          if (duration <= 0) refreshDuration();
        }}
        onDurationChange={refreshDuration}
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (!video) return;
          refreshDuration();
          video.volume = volume;
          video.playbackRate = rate;
        }}
      />

      {captions && captionText ? (
        <Caption aria-hidden="true" $lifted={controlsVisible}>
          {captionText}
        </Caption>
      ) : null}

      {!playing ? (
        <CenterPlay type="button" aria-label={t("audioPlay")} onClick={togglePlay}>
          {PlayIcon}
        </CenterPlay>
      ) : null}

      <Scrim $visible={controlsVisible} />

      {chapterMenuOpen && chapters.length > 0 ? (
        <ChapterMenu role="list" aria-label={t("chapters")}>
          {chapters.map((chapter) => (
            <ChapterItem
              key={chapter.t}
              type="button"
              $active={activeChapter?.t === chapter.t}
              aria-current={activeChapter?.t === chapter.t || undefined}
              onClick={() => {
                seek(chapter.t);
                setChapterMenuOpen(false);
                poke();
              }}
            >
              <span className="time">{formatChapterTime(chapter.t)}</span>
              {chapter.title}
            </ChapterItem>
          ))}
        </ChapterMenu>
      ) : null}

      <Bar $visible={controlsVisible}>
        <SeekWrap>
          {heat ? (
            <HeatCurve viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden>
              <path d={heatAreaPath(heat)} />
            </HeatCurve>
          ) : null}
          <Seek
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            step={1}
            value={Math.floor(currentTime)}
            $percent={percent}
            aria-label={t("audioSeek")}
            aria-valuetext={
              activeChapter
                ? `${formatDuration(currentTime)} / ${formatDuration(duration)} – ${activeChapter.title}`
                : `${formatDuration(currentTime)} / ${formatDuration(duration)}`
            }
            onChange={(e) => seek(Number(e.target.value))}
          />
          {duration > 0
            ? chapters
                .filter((chapter) => chapter.t > 0 && chapter.t < duration)
                .map((chapter) => (
                  <ChapterTick
                    key={chapter.t}
                    $percent={(chapter.t / duration) * 100}
                    aria-hidden
                  />
                ))
            : null}
        </SeekWrap>
        <Row>
          <RoundButton
            type="button"
            aria-label={playing ? t("audioPause") : t("audioPlay")}
            onClick={togglePlay}
          >
            {playing ? PauseIcon : PlayIcon}
          </RoundButton>
          <TimeText aria-hidden>
            {formatDuration(currentTime)} / {formatDuration(duration)}
            {activeChapter ? (
              <>
                {" · "}
                <ChapterName>{activeChapter.title}</ChapterName>
              </>
            ) : null}
          </TimeText>
          <Spacer />
          {chapters.length > 0 ? (
            <RoundButton
              type="button"
              $active={chapterMenuOpen}
              aria-expanded={chapterMenuOpen}
              aria-label={t("chapters")}
              onClick={() => {
                setChapterMenuOpen((v) => !v);
                poke();
              }}
            >
              ≔
            </RoundButton>
          ) : null}
          {hasCaptions ? (
            <CcButton
              type="button"
              $active={captions}
              aria-pressed={captions}
              aria-label={captions ? t("captionsOff") : t("captionsOn")}
              onClick={() => {
                setCaptions((c) => !c);
                poke();
              }}
            >
              CC
            </CcButton>
          ) : null}
          <SpeedButton
            type="button"
            aria-label={t("audioSpeed", { rate: rate.toLocaleString("de") })}
            onClick={() => {
              cycleRate();
              poke();
            }}
          >
            {rate.toLocaleString("de")}×
          </SpeedButton>
          <RoundButton
            type="button"
            aria-label={muted ? t("audioUnmute") : t("audioMute")}
            aria-pressed={muted}
            onClick={() => {
              setMuted((m) => !m);
              poke();
            }}
          >
            {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
          </RoundButton>
          <Volume
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round((muted ? 0 : volume) * 100)}
            $percent={(muted ? 0 : volume) * 100}
            aria-label={t("audioVolume")}
            aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} %`}
            onChange={(e) => changeVolume(Number(e.target.value) / 100)}
          />
          <RoundButton
            type="button"
            $active={theater}
            aria-label={theater ? t("exitTheater") : t("theater")}
            aria-pressed={theater}
            onClick={() => {
              setTheater((v) => !v);
              poke();
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <rect x="2.5" y="6" width="19" height="12" rx="2" />
            </svg>
          </RoundButton>
          <RoundButton
            type="button"
            aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
            aria-pressed={fullscreen}
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M9 4v3a2 2 0 0 1-2 2H4M15 4v3a2 2 0 0 0 2 2h3M9 20v-3a2 2 0 0 0-2-2H4M15 20v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 9V6a2 2 0 0 1 2-2h3M20 9V6a2 2 0 0 0-2-2h-3M4 15v3a2 2 0 0 0 2 2h3M20 15v3a2 2 0 0 1-2 2h-3" />
              </svg>
            )}
          </RoundButton>
        </Row>
      </Bar>
    </Shell>
    </>
  );
}
