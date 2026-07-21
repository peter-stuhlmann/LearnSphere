"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useLocale, useTranslations } from "next-intl";
import { parseYouTubeId } from "@/lib/video";
import { ensureHtml } from "@/lib/richtext";
import type { TranscriptCue } from "@elearning/core/blocks";
import { RichText } from "@/components/ui/RichText";
import { aiGeneratedProps } from "@/lib/ai-marking";
import {
  isAiGenerated,
  type ContentProvenance,
} from "@elearning/core/provenance";
import { resumePosition } from "@elearning/core/media-position";
import type { Chapter } from "@elearning/core/chapters";
import { AudioPlayer } from "./AudioPlayer";
import { KaraokeTranscript } from "./KaraokeTranscript";
import { VideoPlayer } from "./VideoPlayer";
import { YouTubePlayer } from "./YouTubePlayer";

const BlockWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  & + & {
    margin-top: 1.75rem;
    padding-top: 1.75rem;
    border-top: 1px dashed ${({ theme }) => theme.colors.border};
  }
`;

const Caption = styled.h3`
  font-size: 1.05rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Image = styled.img`
  border-radius: ${({ theme }) => theme.radii.md};
  max-width: 100%;
  height: auto;
`;

const FileBox = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 1rem 1.4rem;
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;
  align-self: flex-start;

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const HtmlFrame = styled.iframe`
  width: 100%;
  min-height: 420px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: #fff;
`;

export interface RenderableBlock {
  id: string;
  type: "VIDEO" | "AUDIO" | "IMAGE" | "FILE" | "TEXT" | "HTML";
  title: string;
  url: string;
  fileName: string;
  content: string;
  css: string;
  durationSeconds: number;
  transcriptDe?: string;
  transcriptEn?: string;
  transcriptCues?: TranscriptCue[];
  poster?: string;
  /** Rohe Übersetzungs-Overrides (DB-Json) – von der LearnView aufgelöst */
  translations?: unknown;
  /** Medium/Text stammt aus der Basissprache (Übersetzung fehlt) */
  mediaFallback?: boolean;
  textFallback?: boolean;
  /** Basissprache des Kurses, für das Fallback-Badge (z. B. "de") */
  fallbackLanguage?: string;
  /** Kapitelmarker (gelten für das Basismedium) */
  chapters?: Chapter[];
  /** "Oft geschaut"-Kurve (normalisiert, null = zu wenig Daten) */
  heat?: number[] | null;
  /** Herkunft des angezeigten Inhalts (Fußnote, TEXT/HTML) */
  provenance?: ContentProvenance;
}

const FallbackNote = styled.p`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  padding: 0.25rem 0.7rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textMuted};
`;

/* Herkunfts-Fußnote (Art. 50 KI-VO): dezent unter dem Text-Inhalt */
const ProvenanceNote = styled.p`
  margin-top: 0.5rem;
  font-size: 0.72rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

function ProvenanceFootnote({
  provenance,
  label,
}: {
  provenance: ContentProvenance;
  label: string;
}) {
  return (
    <ProvenanceNote
      // maschinenlesbare Kennzeichnung KI-generierter Inhalte
      {...(isAiGenerated(provenance) ? aiGeneratedProps : {})}
    >
      ⓘ {label}
    </ProvenanceNote>
  );
}

const TranscriptToggle = styled.details`
  margin-top: 0.6rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};

  summary {
    cursor: pointer;
    padding: 0.6rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    user-select: none;
    -webkit-user-select: none;

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  }

  &[open] summary {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

const TranscriptText = styled.div`
  padding: 0.9rem 1rem;
  font-size: 0.92rem;
  line-height: 1.75;
  color: ${({ theme }) => theme.colors.textMuted};
  max-height: 360px;
  overflow-y: auto;

  p + p {
    margin-top: 0.6rem;
  }
`;

/** Transkript in UI-Sprache; Fallback auf die jeweils andere Sprache. */
function transcriptFor(block: RenderableBlock, locale: string): string {
  const primary = locale === "en" ? block.transcriptEn : block.transcriptDe;
  const fallback = locale === "en" ? block.transcriptDe : block.transcriptEn;
  return (primary || fallback || "").trim();
}

function Transcript({
  block,
  mediaTime,
  onSeek,
}: {
  block: RenderableBlock;
  /** Abspielzeit des zugehörigen Mediums (nur für native Player) */
  mediaTime: number | null;
  onSeek: ((seconds: number) => void) | null;
}) {
  const t = useTranslations("learn");
  const locale = useLocale();
  const text = transcriptFor(block, locale);
  const cues = block.transcriptCues ?? [];
  // Karaoke nur, wenn wir das Medium steuern können (eigene Uploads)
  const karaoke = cues.length > 0 && mediaTime !== null && onSeek !== null;
  if (!text && !karaoke) return null;
  return (
    // Transkripte entstehen per Auto-Transkription/-Übersetzung →
    // maschinenlesbar als KI-erzeugt gekennzeichnet (Art. 50 Abs. 2 KI-VO)
    <TranscriptToggle {...aiGeneratedProps}>
      <summary>📄 {t("transcript")}</summary>
      {karaoke ? (
        <KaraokeTranscript
          cues={cues}
          locale={locale}
          time={mediaTime}
          onSeek={onSeek}
        />
      ) : (
        <TranscriptText>
          {/* Rich-Text (serverseitig sanitisiert); Plain-Altbestand wird konvertiert */}
          <RichText html={ensureHtml(text)} />
        </TranscriptText>
      )}
    </TranscriptToggle>
  );
}

export interface MediaCallbacks {
  onTime: (blockId: string, seconds: number) => void;
  onPause: (blockId: string, seconds: number) => void;
  onEnded: (blockId: string) => void;
}

function htmlSrcDoc(block: RenderableBlock): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: system-ui, sans-serif; margin: 16px; }
    ${block.css}
  </style></head><body>${block.content}</body></html>`;
}

/**
 * Rendert die Inhaltsblöcke einer Lektion. HTML-Blöcke laufen in einer
 * Sandbox ohne Skripte, damit Creator-CSS/HTML keinen Zugriff auf die
 * Plattform bekommt.
 */
/**
 * Ein einzelner Block – eigene Komponente, damit Video/Audio ihre
 * Abspielzeit lokal halten können (füttert das Karaoke-Transkript).
 */
function LessonBlock({
  block,
  media,
  startAt = 0,
  registerSeek,
}: {
  block: RenderableBlock;
  media?: MediaCallbacks;
  /** Einstiegs-Sekunde (0 = regulär von vorn) */
  startAt?: number;
  /** meldet die Seek-Funktion des Blocks nach außen (Notizen-Chips) */
  registerSeek?: (blockId: string, fn: ((s: number) => void) | null) => void;
}) {
  const t = useTranslations("learn");
  // Video- und Audio-Player stellen hierüber ihren Seek bereit (Karaoke)
  const mediaSeekRef = useRef<((seconds: number) => void) | null>(null);
  const [mediaTime, setMediaTime] = useState(0);

  const youTubeId = block.type === "VIDEO" ? parseYouTubeId(block.url) : null;
  const nativeVideo = block.type === "VIDEO" && !youTubeId && Boolean(block.url);
  const nativeAudio = block.type === "AUDIO" && Boolean(block.url);
  const nativeMedia = nativeVideo || nativeAudio;

  function seekTo(seconds: number) {
    mediaSeekRef.current?.(seconds);
  }

  // Seek nach außen anbieten (Notizen springen an ihre Sekunde)
  const blockId = block.id;
  useEffect(() => {
    if (!registerSeek || !nativeMedia) return;
    registerSeek(blockId, (seconds) => mediaSeekRef.current?.(seconds));
    return () => registerSeek(blockId, null);
  }, [registerSeek, nativeMedia, blockId]);

  return (
    <BlockWrap>
      {block.title ? <Caption>{block.title}</Caption> : null}

      {block.mediaFallback || block.textFallback ? (
        <FallbackNote>
          🌐{" "}
          {t("contentFallback", {
            lang: (block.fallbackLanguage ?? "").toUpperCase(),
          })}
        </FallbackNote>
      ) : null}

      {block.type === "VIDEO" && youTubeId ? (
        <YouTubePlayer
          videoId={youTubeId}
          title={block.title || t("progress")}
          startAt={startAt}
          onTime={(s) => media?.onTime(block.id, s)}
          onPause={(s) => media?.onPause(block.id, s)}
          onEnded={() => media?.onEnded(block.id)}
        />
      ) : null}

      {nativeVideo ? (
        <VideoPlayer
          src={block.url}
          title={block.title || t("progress")}
          cues={block.transcriptCues}
          poster={block.poster}
          fallbackDuration={block.durationSeconds}
          startAt={startAt}
          chapters={block.chapters ?? []}
          heat={block.heat ?? null}
          seekRef={mediaSeekRef}
          onTime={(s) => {
            setMediaTime(s);
            media?.onTime(block.id, s);
          }}
          onPause={(s) => media?.onPause(block.id, s)}
          onEnded={() => media?.onEnded(block.id)}
        />
      ) : null}

      {nativeAudio ? (
        <AudioPlayer
          src={block.url}
          title={block.title || t("audioPlay")}
          fallbackDuration={block.durationSeconds}
          startAt={startAt}
          seekRef={mediaSeekRef}
          onTime={(s) => {
            setMediaTime(s);
            media?.onTime(block.id, s);
          }}
          onPause={(s) => media?.onPause(block.id, s)}
          onEnded={() => media?.onEnded(block.id)}
        />
      ) : null}

      {block.type === "VIDEO" || block.type === "AUDIO" ? (
        <Transcript
          block={block}
          mediaTime={nativeMedia ? mediaTime : null}
          onSeek={nativeMedia ? seekTo : null}
        />
      ) : null}

      {block.type === "IMAGE" && block.url ? (
        <Image src={block.url} alt={block.title || ""} />
      ) : null}

      {block.type === "FILE" && block.url ? (
        <FileBox
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          download={block.fileName || undefined}
        >
          ⬇ {t("downloadFile")}: {block.fileName || block.url}
        </FileBox>
      ) : null}

      {block.type === "TEXT" ? (
        <div>
          <RichText html={block.content} />
          <ProvenanceFootnote
            provenance={block.provenance ?? "HUMAN"}
            label={t(`provenance.${block.provenance ?? "HUMAN"}` as never)}
          />
        </div>
      ) : null}

      {block.type === "HTML" ? (
        <div>
          <HtmlFrame
            sandbox=""
            srcDoc={htmlSrcDoc(block)}
            title={block.title || "HTML"}
          />
          <ProvenanceFootnote
            provenance={block.provenance ?? "HUMAN"}
            label={t(`provenance.${block.provenance ?? "HUMAN"}` as never)}
          />
        </div>
      ) : null}
    </BlockWrap>
  );
}

export function BlockRenderer({
  blocks,
  media,
  positions,
  registerSeek,
}: {
  blocks: RenderableBlock[];
  media?: MediaCallbacks;
  /** letzte Abspielposition je Block – Medien setzen dort fort */
  positions?: Record<string, number>;
  /** meldet Seek-Funktionen der Medienblöcke (für Notizen-Zeitstempel) */
  registerSeek?: (blockId: string, fn: ((s: number) => void) | null) => void;
}) {
  return (
    <>
      {blocks.map((block) => (
        <LessonBlock
          key={block.id}
          block={block}
          media={media}
          registerSeek={registerSeek}
          startAt={resumePosition(
            positions?.[block.id],
            block.durationSeconds
          )}
        />
      ))}
    </>
  );
}
