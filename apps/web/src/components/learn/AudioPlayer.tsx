"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";
import { formatDuration } from "@elearning/core/format";

const Shell = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background:
    radial-gradient(ellipse 120% 200% at 0% 50%, rgba(139, 124, 255, 0.12), transparent 60%),
    ${({ theme }) => theme.colors.bgElevated};

  @media (max-width: 479px) {
    flex-wrap: wrap;
  }
`;

const PlayButton = styled.button<{ $playing: boolean }>`
  flex-shrink: 0;
  width: 56px;
  height: 56px;
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
  transition: transform 160ms ease, box-shadow 160ms ease;

  ${({ $playing, theme }) =>
    $playing
      ? css`
          box-shadow: ${theme.shadows.glow};
        `
      : ""}

  &:hover {
    transform: scale(1.06);
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }

  &:active {
    transform: scale(0.96);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const bounce = keyframes`
  0%, 100% { transform: scaleY(0.35); }
  50% { transform: scaleY(1); }
`;

const Equalizer = styled.div<{ $playing: boolean }>`
  display: flex;
  align-items: center;
  gap: 3px;
  height: 28px;
  flex-shrink: 0;

  span {
    width: 4px;
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
              animation-delay: 100ms;
            }
            &:nth-child(5) {
              animation-delay: 250ms;
            }
          `
        : ""}
  }

  @media (prefers-reduced-motion: reduce) {
    span {
      animation: none !important;
    }
  }
`;

const Middle = styled.div`
  flex: 1;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
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
    ${({ theme }) => theme.colors.surface} ${({ $percent }) => $percent}%
  );
  border: 1px solid ${({ theme }) => theme.colors.border};

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

const TimeRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const MuteButton = styled.button<{ $muted: boolean }>`
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme, $muted }) =>
    $muted ? theme.colors.danger : theme.colors.textMuted};
  font-size: 1rem;

  &:hover {
    color: ${({ theme, $muted }) =>
      $muted ? theme.colors.danger : theme.colors.text};
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }
`;

const Controls = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
`;

const Volume = styled.input<{ $percent: number }>`
  appearance: none;
  width: 76px;
  height: 5px;
  border-radius: 999px;
  cursor: pointer;
  background: linear-gradient(
    to right,
    ${({ theme }) => theme.colors.accent} ${({ $percent }) => $percent}%,
    ${({ theme }) => theme.colors.surface} ${({ $percent }) => $percent}%
  );
  border: 1px solid ${({ theme }) => theme.colors.border};

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
`;

const SpeedButton = styled.button`
  flex-shrink: 0;
  min-width: 52px;
  height: 32px;
  padding-inline: 0.6rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textMuted};

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

interface AudioPlayerProps {
  src: string;
  title: string;
  /** Bekannte Dauer (Sekunden) als Fallback, bis der Browser sie meldet */
  fallbackDuration?: number;
  /** gemerkte Abspielposition: dort fortsetzen (0 = regulär von vorn) */
  startAt?: number;
  onTime?: (seconds: number) => void;
  onPause?: (seconds: number) => void;
  onEnded?: () => void;
  /** erlaubt dem Karaoke-Transkript, von außen zu springen (+ Play) */
  seekRef?: React.RefObject<((seconds: number) => void) | null>;
}

export function AudioPlayer({
  src,
  title,
  fallbackDuration = 0,
  startAt = 0,
  onTime,
  onPause,
  onEnded,
  seekRef,
}: AudioPlayerProps) {
  const t = useTranslations("learn");
  const audioRef = useRef<HTMLAudioElement>(null);
  /** startAt nur beim ersten Metadaten-Load anwenden */
  const resumedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() =>
    fallbackDuration > 0 ? fallbackDuration : 0
  );

  /** Präzise Browser-Dauer übernehmen, sobald sie (endlich) bekannt ist */
  function refreshDuration() {
    const mediaDuration = audioRef.current?.duration;
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
    const audio = audioRef.current;
    if (!audio || resumedRef.current || startAt <= 0) return;
    const applyResume = () => {
      if (resumedRef.current) return;
      resumedRef.current = true;
      if (!Number.isFinite(audio.duration) || startAt < audio.duration) {
        audio.currentTime = startAt;
        setCurrentTime(startAt);
      }
    };
    if (audio.readyState >= 1) {
      applyResume();
      return;
    }
    audio.addEventListener("loadedmetadata", applyResume, { once: true });
    return () => audio.removeEventListener("loadedmetadata", applyResume);
  }, [startAt]);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  function changeVolume(next: number) {
    setVolume(next);
    if (next > 0) setMuted(false);
    if (audioRef.current) audioRef.current.volume = next;
  }

  function cycleRate() {
    const index = PLAYBACK_RATES.indexOf(
      rate as (typeof PLAYBACK_RATES)[number]
    );
    const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }

  // externen Seek-Zugriff bereitstellen (Karaoke-Transkript)
  useEffect(() => {
    if (!seekRef) return;
    seekRef.current = (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = seconds;
      setCurrentTime(seconds);
      void audio.play();
    };
    return () => {
      seekRef.current = null;
    };
  }, [seekRef]);

  return (
    <Shell role="group" aria-label={title}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        muted={muted}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          onPause?.(audioRef.current?.currentTime ?? 0);
        }}
        onEnded={() => {
          setPlaying(false);
          onEnded?.();
        }}
        onTimeUpdate={() => {
          const time = audioRef.current?.currentTime ?? 0;
          setCurrentTime(time);
          onTime?.(time);
          // manche Dateien liefern die Dauer erst während der Wiedergabe
          if (duration <= 0) refreshDuration();
        }}
        onDurationChange={refreshDuration}
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (!audio) return;
          refreshDuration();
          // Einstellungen nach dem (Neu-)Laden wieder anwenden
          audio.volume = volume;
          audio.playbackRate = rate;
        }}
      />

      <PlayButton
        type="button"
        $playing={playing}
        aria-label={playing ? t("audioPause") : t("audioPlay")}
        onClick={togglePlay}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5.5a1 1 0 0 1 1.53-.85l10 6.5a1 1 0 0 1 0 1.7l-10 6.5A1 1 0 0 1 8 18.5v-13z" />
          </svg>
        )}
      </PlayButton>

      <Equalizer $playing={playing} aria-hidden>
        <span />
        <span />
        <span />
        <span />
        <span />
      </Equalizer>

      <Middle>
        <Seek
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          step={1}
          value={Math.floor(currentTime)}
          $percent={percent}
          aria-label={t("audioSeek")}
          aria-valuetext={`${formatDuration(currentTime)} / ${formatDuration(duration)}`}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <TimeRow aria-hidden>
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </TimeRow>
      </Middle>

      <Controls>
        <SpeedButton
          type="button"
          aria-label={t("audioSpeed", {
            rate: rate.toLocaleString("de"),
          })}
          onClick={cycleRate}
        >
          {rate.toLocaleString("de")}×
        </SpeedButton>

        <MuteButton
          type="button"
          $muted={muted}
          aria-label={muted ? t("audioUnmute") : t("audioMute")}
          aria-pressed={muted}
          onClick={() => setMuted((m) => !m)}
        >
          {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
        </MuteButton>

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
      </Controls>
    </Shell>
  );
}
