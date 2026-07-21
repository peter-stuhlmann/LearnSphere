"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import type { BlockTypeName, TranscriptCue } from "@elearning/core/blocks";
import {
  CONTENT_PROVENANCES,
  provenanceAfterEdit,
  type ContentProvenance,
} from "@elearning/core/provenance";
import {
  formatChapterTime,
  MAX_CHAPTERS,
  parseTimeInput,
  type Chapter,
} from "@elearning/core/chapters";
import {
  EMPTY_BLOCK_TRANSLATION,
  type BlockTranslationDraft,
} from "@elearning/core/course-i18n";
import { uploadKindForBlockType } from "@/lib/upload";
import { isLocalUploadUrl } from "@elearning/core/media-url";
import {
  Badge,
  DangerButton,
  GhostButton,
  Muted,
} from "@/components/ui/primitives";
import { formatDuration } from "@elearning/core/format";
import { Field } from "@/components/ui/Field";
import { RichTextEditor } from "@/components/ui/RichTextEditorLazy";
import { useUnsavedMarker } from "@/components/ui/UnsavedChangesGuard";
import { AudioPlayer } from "@/components/learn/AudioPlayer";
import { VideoPlayer } from "@/components/learn/VideoPlayer";
import { YouTubePlayer } from "@/components/learn/YouTubePlayer";
import { parseYouTubeId } from "@/lib/video";
import { fetchYouTubeDuration } from "@/app/actions/video-actions";
import {
  transcribeBlockMedia,
  translateBlockSegments,
  translateBlockTranscript,
} from "@/app/actions/transcript-actions";
import { suggestChapters } from "@/app/actions/copilot-actions";
import { ensureHtml, plainTextToHtml } from "@/lib/richtext";

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border: 1px dashed ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};
`;

const BlockPanel = styled.fieldset`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  background: ${({ theme }) => theme.colors.bgElevated};
`;

const BlockHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
`;

/* Blocktyp-Wahl: Radiogroup als Icon-Buttons statt Dropdown */
const TypeGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
`;

const TypeRadio = styled.input`
  position: absolute;
  opacity: 0;
  pointer-events: none;
`;

const TypeOption = styled.label<{ $selected: boolean }>`
  position: relative;
  width: 34px;
  height: 30px;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid
    ${({ theme, $selected }) =>
      $selected ? "rgba(200, 255, 77, 0.45)" : theme.colors.border};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSoft : "transparent"};
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accent : theme.colors.textFaint};
  transition: color 140ms ease, border-color 140ms ease,
    background 140ms ease;

  &:hover {
    color: ${({ theme, $selected }) =>
      $selected ? theme.colors.accent : theme.colors.text};
    border-color: ${({ theme, $selected }) =>
      $selected ? "rgba(200, 255, 77, 0.45)" : theme.colors.borderStrong};
  }

  &:has(input:focus-visible) {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  svg {
    width: 16px;
    height: 16px;
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/**
 * Hübscher Tooltip statt title-Attribut: erscheint bei Hover UND
 * Tastatur-Fokus. Für Screenreader bewusst aria-hidden – der zugängliche
 * Name der Buttons kommt bereits vom aria-label des Radio-Inputs, sonst
 * würde alles doppelt vorgelesen.
 */
const TypeTip = styled.span`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(3px);
  padding: 0.32rem 0.6rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgDeep};
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: ${({ theme }) => theme.shadows.card};
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease 250ms, transform 140ms ease 250ms;
  z-index: 5;

  /* kleiner Pfeil zum Button */
  &::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: ${({ theme }) => theme.colors.borderStrong};
  }

  ${TypeOption}:hover > &,
  ${TypeOption}:has(input:focus-visible) > & {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  /* Fokus zeigt den Tooltip sofort – nur Hover hat die kleine Verzögerung */
  ${TypeOption}:has(input:focus-visible) > & {
    transition-delay: 0ms;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/** Minimalistische Stroke-Icons je Blocktyp (16×16, currentColor) */
const TYPE_ICONS: Record<BlockTypeName, ReactNode> = {
  VIDEO: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <rect x="1.5" y="3" width="13" height="10" rx="2" />
      <path d="M6.5 6 L10.5 8 L6.5 10 Z" fill="currentColor" stroke="none" />
    </svg>
  ),
  AUDIO: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M6 12.5 V4.5 L12.5 3 V11" />
      <circle cx="4.5" cy="12.5" r="1.7" />
      <circle cx="11" cy="11" r="1.7" />
    </svg>
  ),
  IMAGE: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <circle cx="5.5" cy="6" r="1.2" />
      <path d="M2.5 12 L6.5 8 L9 10.5 L11 8.5 L13.5 11" strokeLinecap="round" />
    </svg>
  ),
  FILE: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M4 1.5 H9.5 L13 5 V14.5 H4 Z" />
      <path d="M9.5 1.5 V5 H13" />
    </svg>
  ),
  TEXT: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2.5 4 H13.5 M2.5 8 H13.5 M2.5 12 H9.5" />
    </svg>
  ),
  HTML: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 4.5 L2 8 L5.5 11.5 M10.5 4.5 L14 8 L10.5 11.5" />
    </svg>
  ),
};

const SmallButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  width: 30px;
  height: 30px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.8rem;

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.text};
  }

  &:disabled {
    opacity: 0.35;
  }
`;

const Textarea = styled.textarea`
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.85rem 1rem;
  min-height: 120px;
  resize: vertical;
  width: 100%;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.85rem;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

const RowSplit = styled.div`
  display: grid;
  gap: 0.8rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const UploadRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.92rem;
  cursor: pointer;

  input {
    width: 18px;
    height: 18px;
    accent-color: ${({ theme }) => theme.colors.accent};
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
`;

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.danger};
  font-size: 0.85rem;
`;

export interface BlockDraft {
  type: BlockTypeName;
  title: string;
  url: string;
  fileName: string;
  content: string;
  css: string;
  durationSeconds: number;
  transcriptDe: string;
  transcriptEn: string;
  transcriptCues: TranscriptCue[];
  /** Vorschaubild für Videos – Upload befüllt es automatisch mit Frame 1 */
  poster: string;
  /** Kapitelmarker (Video/Audio) */
  chapters: Chapter[];
  /** Herkunft des Inhalts (TEXT/HTML) – Fußnote für Lernende */
  provenance: ContentProvenance;
  /** Übersetzungs-Overrides je Zusatzsprache; leere Felder = Basissprache */
  translations: Record<string, BlockTranslationDraft>;
}

export interface LessonDraft {
  title: string;
  isPreview: boolean;
  blocks: BlockDraft[];
  /** Übersetzte Lektionstitel je Zusatzsprache */
  translations: Record<string, { title: string }>;
}

export const EMPTY_BLOCK: BlockDraft = {
  type: "VIDEO",
  title: "",
  url: "",
  fileName: "",
  content: "",
  css: "",
  durationSeconds: 0,
  transcriptDe: "",
  transcriptEn: "",
  transcriptCues: [],
  poster: "",
  chapters: [],
  provenance: "HUMAN",
  translations: {},
};

export const EMPTY_LESSON: LessonDraft = {
  title: "",
  isPreview: false,
  blocks: [{ ...EMPTY_BLOCK }],
  translations: {},
};

/* ---------- Herkunfts-Kennzeichnung (Fußnote für Lernende) ---------- */

const ProvRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
`;

const ProvLabel = styled.p`
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 0.75rem 0 0.35rem;
`;

const ProvChip = styled.button<{ $active: boolean }>`
  padding: 0.3rem 0.75rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.75rem;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? "rgba(200, 255, 77, 0.5)" : theme.colors.border};
  background: ${({ $active }) =>
    $active ? "rgba(200, 255, 77, 0.1)" : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.textMuted};

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const ProvConfirm = styled(ProvChip)`
  border-color: ${({ theme }) => theme.colors.success};
  color: ${({ theme }) => theme.colors.success};
  font-weight: 600;
`;

/**
 * Herkunft eines Text-Inhalts wählen. Lernende sehen die Auswahl als
 * Fußnote unter dem Block. Bei "KI-generiert" gibt es einen expliziten
 * Bestätigen-Button für die menschliche Prüfung.
 */
function ProvenanceSelect({
  value,
  onChange,
}: {
  value: ContentProvenance;
  onChange: (provenance: ContentProvenance) => void;
}) {
  const t = useTranslations("dashboard");
  return (
    <div>
      <ProvLabel>{t("provenanceLabel")}</ProvLabel>
      <ProvRow role="radiogroup" aria-label={t("provenanceLabel")}>
        {CONTENT_PROVENANCES.map((provenance) => (
          <ProvChip
            key={provenance}
            type="button"
            role="radio"
            aria-checked={provenance === value}
            $active={provenance === value}
            onClick={() => onChange(provenance)}
          >
            {t(`provenance.${provenance}` as never)}
          </ProvChip>
        ))}
        {value === "AI" ? (
          <ProvConfirm
            type="button"
            $active={false}
            onClick={() => onChange("AI_REVIEWED")}
          >
            ✓ {t("provenanceConfirmReview")}
          </ProvConfirm>
        ) : null}
      </ProvRow>
    </div>
  );
}

/** Liest die Abspieldauer einer Video-/Audiodatei clientseitig aus. */
const noop = () => {};

const MediaPreview = styled.div`
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

/**
 * Weicher Wechsel zwischen zwei Ansichten (Vorschau ↔ URL-Feld): beide
 * bleiben gemountet, die inaktive klappt per Grid-Transition zu.
 */
const SwapCollapse = styled.div<{ $show: boolean }>`
  display: grid;
  grid-template-rows: ${({ $show }) => ($show ? "1fr" : "0fr")};
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  transition: grid-template-rows 300ms ease, opacity 300ms ease;

  > div {
    overflow: hidden;
    /* Puffer, damit Fokus-Ringe nicht am overflow abgeschnitten werden */
    padding: 3px;
    margin: -3px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const MediaMetaRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

/** Dauer einer per URL eingetragenen Mediendatei ermitteln (best effort). */
function readUrlDuration(
  url: string,
  kind: "video" | "audio"
): Promise<number> {
  return new Promise((resolve) => {
    const element = document.createElement(kind);
    let settled = false;
    const done = (seconds: number) => {
      if (settled) return;
      settled = true;
      element.removeAttribute("src");
      resolve(seconds);
    };
    const timer = window.setTimeout(() => done(0), 10_000);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(
        Number.isFinite(element.duration) ? Math.round(element.duration) : 0
      );
    };
    element.onerror = () => {
      window.clearTimeout(timer);
      done(0);
    };
    element.src = url;
  });
}

function readMediaDuration(file: File, kind: "video" | "audio"): Promise<number> {
  return new Promise((resolve) => {
    const element = document.createElement(kind);
    const objectUrl = URL.createObjectURL(file);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(
        Number.isFinite(element.duration) ? Math.round(element.duration) : 0
      );
    };
    element.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(0);
    };
    element.src = objectUrl;
  });
}

function BlockUpload({
  block,
  onUploaded,
}: {
  block: BlockDraft;
  onUploaded: (patch: Partial<BlockDraft>) => void;
}) {
  const t = useTranslations("dashboard");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  /** null = ok; "" = generischer Fehler; sonst Ablehnungsgrund (Moderation) */
  const [failed, setFailed] = useState<string | null>(null);

  const kind = uploadKindForBlockType(block.type);
  if (!kind) return null;

  const accept = {
    video: "video/mp4,video/webm,video/quicktime",
    audio: "audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/x-m4a",
    image: "image/jpeg,image/png,image/webp,image/gif",
    file: ".pdf,.zip,.docx,.xlsx,.pptx,.txt,.csv,.json",
  }[kind];

  async function onFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setFailed(null);
    setUploading(true);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("kind", kind!);

    try {
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          reason?: string;
        } | null;
        setFailed(body?.error === "content_flagged" ? (body.reason ?? "") : "");
        return;
      }
      const data = (await res.json()) as {
        url: string;
        fileName: string;
        poster?: string | null;
      };
      const patch: Partial<BlockDraft> = { url: data.url };
      if (block.type === "FILE") {
        patch.fileName = block.fileName || data.fileName;
      }
      if (kind === "video" || kind === "audio") {
        patch.durationSeconds = await readMediaDuration(file, kind);
      }
      // automatisch erzeugtes Poster (1. Frame) vorbelegen
      if (block.type === "VIDEO" && data.poster) {
        patch.poster = data.poster;
      }
      onUploaded(patch);
    } catch {
      setFailed("");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <UploadRow>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        onChange={onFile}
        style={{ display: "none" }}
        aria-hidden
        tabIndex={-1}
      />
      <GhostButton
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        ⬆ {uploading ? t("uploading") : t("upload")}
      </GhostButton>
      <span>{t(`uploadHints.${kind}` as never)}</span>
      {failed !== null ? (
        <ErrorText role="alert">
          {failed ? t("uploadRejected", { reason: failed }) : t("uploadFailed")}
        </ErrorText>
      ) : null}
    </UploadRow>
  );
}

const PosterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;

  img {
    width: 128px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: ${({ theme }) => theme.radii.sm};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: #000;
  }

  span {
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

/**
 * Poster (Vorschaubild) eines Video-Blocks: Beim Upload wird automatisch
 * Frame 1 gesetzt; hier lässt es sich durch ein eigenes Bild ersetzen
 * oder entfernen.
 */
function PosterPicker({
  block,
  onPatch,
}: {
  block: BlockDraft;
  onPatch: (patch: Partial<BlockDraft>) => void;
}) {
  const t = useTranslations("dashboard");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  /** null = ok; "" = generischer Fehler; sonst Ablehnungsgrund (Moderation) */
  const [failed, setFailed] = useState<string | null>(null);

  async function onFile() {
    const file = fileRef.current?.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setFailed(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", "image");
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          reason?: string;
        } | null;
        setFailed(body?.error === "content_flagged" ? (body.reason ?? "") : "");
        return;
      }
      const data = (await res.json()) as { url: string };
      onPatch({ poster: data.url });
    } catch {
      setFailed("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <PosterRow>
      {block.poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- eigener Upload-Pfad
        <img src={block.poster} alt={t("posterLabel")} />
      ) : (
        <span>{t("posterEmpty")}</span>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={() => void onFile()}
      />
      <GhostButton
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        🖼 {uploading ? t("uploading") : t("posterUpload")}
      </GhostButton>
      {block.poster ? (
        <GhostButton type="button" onClick={() => onPatch({ poster: "" })}>
          ✕ {t("posterRemove")}
        </GhostButton>
      ) : null}
      {failed !== null ? (
        <ErrorText role="alert">
          {failed ? t("uploadRejected", { reason: failed }) : t("uploadFailed")}
        </ErrorText>
      ) : null}
    </PosterRow>
  );
}

/* ---------- Sprecher-Verwaltung (Diarization) im Transkript-Panel ---------- */

const SpeakerTools = styled.div`
  margin-top: 1rem;
  padding-top: 0.9rem;
  border-top: 1px dashed ${({ theme }) => theme.colors.border};
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const SpeakerToolsTitle = styled.p`
  font-size: 0.82rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const RenameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const SpeakerNameTag = styled.span`
  min-width: 90px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.accent};
`;

const RenameInput = styled.input`
  flex: 1;
  min-width: 140px;
  max-width: 240px;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  padding: 0.4rem 0.7rem;
  font-size: 0.85rem;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

const SegmentList = styled.ul`
  list-style: none;
  margin-top: 0.4rem;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`;

const SegmentRow = styled.li`
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  font-size: 0.8rem;
  padding: 0.25rem 0.35rem;
  border-radius: ${({ theme }) => theme.radii.sm};

  &:hover {
    background: ${({ theme }) => theme.colors.bgElevated};
  }
`;

const SegmentTime = styled.span`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const SegmentChips = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  gap: 0.25rem;
`;

const SpeakerChip = styled.button<{ $active: boolean }>`
  padding: 0.15rem 0.55rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.72rem;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? "rgba(200, 255, 77, 0.5)" : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.textMuted};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 1px;
  }
`;

const SegmentText = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TranscriptBox = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.6rem 0.9rem;
`;

/* ---------- Kapitelmarker-Editor ---------- */

const ChapterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ChapterTimeInput = styled.input`
  width: 82px;
  text-align: center;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.85rem;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  padding: 0.4rem 0.4rem;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }

  &[aria-invalid="true"] {
    border-color: ${({ theme }) => theme.colors.danger};
  }
`;

const ChapterTitleInput = styled.input`
  flex: 1;
  min-width: 120px;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  padding: 0.4rem 0.7rem;
  font-size: 0.88rem;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

const ChapterActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
`;

const ChapterError = styled.p`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.danger};
`;

const TranscriptToggle = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;

const Chevron = styled.span<{ $open: boolean }>`
  display: inline-block;
  transition: transform 250ms ease;
  transform: rotate(${({ $open }) => ($open ? "90deg" : "0deg")});

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* Grid-Trick für sanftes Auf-/Zuklappen auf unbekannte Höhe */
const CollapsePanel = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${({ $open }) => ($open ? "1fr" : "0fr")};
  transition: grid-template-rows 300ms ease;

  > div {
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* Wie CollapsePanel, nur für Status-/Fehlerzeilen: klappt beim Erscheinen
   und Verschwinden sanft statt zu springen (bleibt daher immer gemountet) */
const StatusCollapse = styled.div<{ $show: boolean }>`
  display: grid;
  grid-template-rows: ${({ $show }) => ($show ? "1fr" : "0fr")};
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  transition: grid-template-rows 250ms ease, opacity 250ms ease;

  > div {
    overflow: hidden;

    > * {
      margin-top: 0.55rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const LangTabs = styled.div`
  display: inline-flex;
  gap: 0.25rem;
  margin-top: 0.75rem;
  padding: 0.2rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.bg};
`;

const LangTab = styled.button<{ $active: boolean }>`
  padding: 0.4rem 1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.82rem;
  transition: background 150ms ease, color 150ms ease;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accent : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.onAccent : theme.colors.textMuted};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};

  &:hover {
    color: ${({ theme, $active }) =>
      $active ? theme.colors.onAccent : theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const TabPanel = styled.div`
  margin-top: 0.6rem;
`;

const TRANSCRIPT_ERRORS = [
  "transcription_unavailable",
  "url_not_upload",
  "file_too_large",
  "video_needs_ffmpeg",
  "transcribe_failed",
  "translation_unavailable",
  "translate_failed",
];

export interface TranscriptStatus {
  state: "transcribing" | "translating" | null;
  error: string | null;
  /** zwingt den TipTap-Editor nach programmatischen Änderungen zum Neuladen */
  version: number;
  /** Sprache des zuletzt automatisch gesetzten Inhalts */
  lastLang?: "de" | "en";
}

const StatusLine = styled.p`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.accent};
`;

/**
 * Transkript-Anzeige je Video-/Audio-Block: wird nach dem Upload automatisch
 * befüllt (Transkription + Übersetzung), hier nur noch prüfen/bearbeiten.
 */
/**
 * Kapitelmarker (Video/Audio): manuell pflegen oder per KI aus dem
 * Transkript vorschlagen lassen. Zeiten als "m:ss"; leere Titel werden
 * beim Speichern verworfen.
 */
function ChapterEditor({
  block,
  onPatch,
  baseLang,
}: {
  block: BlockDraft;
  onPatch: (patch: Partial<BlockDraft>) => void;
  baseLang: string;
}) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(block.chapters.length > 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidTimes, setInvalidTimes] = useState<Record<number, boolean>>(
    {}
  );

  const transcriptSource =
    baseLang === "en"
      ? block.transcriptEn || block.transcriptDe
      : block.transcriptDe || block.transcriptEn;

  function patchChapter(index: number, patch: Partial<Chapter>) {
    onPatch({
      chapters: block.chapters.map((chapter, i) =>
        i === index ? { ...chapter, ...patch } : chapter
      ),
    });
  }

  function addChapter() {
    const last = block.chapters[block.chapters.length - 1];
    const next = last ? last.t + 60 : 0;
    onPatch({
      chapters: [
        ...block.chapters,
        {
          t:
            block.durationSeconds > 0
              ? Math.min(next, Math.max(0, block.durationSeconds - 1))
              : next,
          title: "",
        },
      ],
    });
  }

  async function runSuggest() {
    if (
      block.chapters.length > 0 &&
      !window.confirm(t("chaptersReplaceConfirm"))
    ) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await suggestChapters({
      transcript: transcriptSource,
      durationSeconds: block.durationSeconds,
      language: baseLang,
    });
    setPending(false);
    if (result.ok && result.chapters) {
      onPatch({ chapters: result.chapters });
      setInvalidTimes({});
    } else {
      setError(
        result.error === "transcript_too_short"
          ? t("chaptersTranscriptShort")
          : result.error === "unavailable"
            ? t("chaptersUnavailable")
            : t("chaptersSuggestFailed")
      );
    }
  }

  return (
    <TranscriptBox>
      <TranscriptToggle
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        🕘 {t("chapters")}
        {block.chapters.length > 0 ? ` (${block.chapters.length})` : ""}{" "}
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </TranscriptToggle>

      {open ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginTop: "0.6rem",
          }}
        >
          <Muted style={{ fontSize: "0.78rem" }}>{t("chaptersHint")}</Muted>

          {block.chapters.map((chapter, index) => (
            <ChapterRow key={index}>
              <ChapterTimeInput
                key={`${index}-${chapter.t}`}
                defaultValue={formatChapterTime(chapter.t)}
                aria-label={t("chapterTime")}
                aria-invalid={invalidTimes[index] ? "true" : undefined}
                onBlur={(e) => {
                  const seconds = parseTimeInput(e.target.value);
                  if (seconds === null) {
                    setInvalidTimes((prev) => ({ ...prev, [index]: true }));
                    return;
                  }
                  setInvalidTimes((prev) => ({ ...prev, [index]: false }));
                  patchChapter(index, { t: seconds });
                  e.target.value = formatChapterTime(seconds);
                }}
              />
              <ChapterTitleInput
                value={chapter.title}
                placeholder={t("chapterTitle")}
                aria-label={t("chapterTitle")}
                maxLength={120}
                onChange={(e) =>
                  patchChapter(index, { title: e.target.value })
                }
              />
              <SmallButton
                type="button"
                aria-label={`${t("deleteChapter")}: ${
                  chapter.title || formatChapterTime(chapter.t)
                }`}
                onClick={() =>
                  onPatch({
                    chapters: block.chapters.filter((_, i) => i !== index),
                  })
                }
              >
                ✕
              </SmallButton>
            </ChapterRow>
          ))}

          <ChapterActions>
            <GhostButton
              type="button"
              disabled={block.chapters.length >= MAX_CHAPTERS}
              onClick={addChapter}
            >
              + {t("addChapter")}
            </GhostButton>
            <GhostButton
              type="button"
              disabled={pending || !transcriptSource}
              title={!transcriptSource ? t("chaptersNeedTranscript") : undefined}
              onClick={runSuggest}
            >
              {pending ? t("chaptersSuggesting") : `✦ ${t("suggestChapters")}`}
            </GhostButton>
          </ChapterActions>
          {error ? <ChapterError role="alert">{error}</ChapterError> : null}
        </div>
      ) : null}
    </TranscriptBox>
  );
}

function TranscriptEditor({
  block,
  onPatch,
  status,
  onRetry,
  onTranscriptsChanged,
}: {
  block: BlockDraft;
  onPatch: (patch: Partial<BlockDraft>) => void;
  status?: TranscriptStatus;
  onRetry: () => void;
  /** nach programmatischen Textänderungen (Umbenennen) den RTE neu laden */
  onTranscriptsChanged: () => void;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [tab, setTab] = useState<"de" | "en">("de");
  // standardmäßig immer zugeklappt – öffnet ausschließlich per Klick
  const [open, setOpen] = useState(false);
  // Editor erst nach dem ersten Öffnen mounten (lazy TipTap), danach für
  // die Zuklapp-Animation gemountet lassen
  const [everOpened, setEverOpened] = useState(false);

  const busy = status?.state ?? null;
  const version = status?.version ?? 0;
  const hasTranscript = Boolean(block.transcriptDe || block.transcriptEn);
  // Automatik nur für eigene Uploads – YouTube & Co. liefern keine Datei
  const canAuto = isLocalUploadUrl(block.url);

  // Trifft ein Automatik-Ergebnis ein, zum passenden Sprach-Tab springen
  // (State-Anpassung während des Renders – offizielles React-Muster)
  const [prevVersion, setPrevVersion] = useState(version);
  if (prevVersion !== version) {
    setPrevVersion(version);
    if (status?.lastLang) setTab(status.lastLang);
  }

  // Text der Status-/Fehlerzeile beim Ausblenden behalten, damit die
  // Zuklapp-Animation nicht mit leerem Inhalt läuft
  const [lastBusy, setLastBusy] = useState<"transcribing" | "translating">(
    "transcribing"
  );
  if (busy && busy !== lastBusy) setLastBusy(busy);
  const [lastError, setLastError] = useState<string | null>(null);
  if (status?.error && status.error !== lastError) setLastError(status.error);

  const activeValue = tab === "de" ? block.transcriptDe : block.transcriptEn;
  const activeField = tab === "de" ? "transcriptDe" : "transcriptEn";

  const uid = useId();
  const panelId = `${uid}-transcript-collapse`;

  // ----- Sprecher-Verwaltung (nur bei diarisierten Transkripten) -----
  const speakerOrder: string[] = [];
  for (const cue of block.transcriptCues) {
    if (cue.speaker && !speakerOrder.includes(cue.speaker)) {
      speakerOrder.push(cue.speaker);
    }
  }
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [showSegments, setShowSegments] = useState(false);

  function displaySpeaker(speaker: string): string {
    return /^\d+$/.test(speaker)
      ? t("speakerNumbered", { n: speaker })
      : speaker;
  }

  /** Sprecher überall umbenennen: alle Cues + "…:"-Prefixe im Transkript. */
  function renameSpeaker(oldLabel: string) {
    const name = (nameDrafts[oldLabel] ?? "").trim().slice(0, 40);
    if (!name || name === oldLabel) return;

    const patch: Partial<BlockDraft> = {
      transcriptCues: block.transcriptCues.map((cue) =>
        cue.speaker === oldLabel ? { ...cue, speaker: name } : cue
      ),
    };
    // Der generierte Transkript-Text nutzt "Person N:" bzw. den alten Namen
    const oldPrefix = /^\d+$/.test(oldLabel) ? `Person ${oldLabel}` : oldLabel;
    const escaped = oldPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixPattern = new RegExp(`${escaped}:`, "g");
    if (block.transcriptDe) {
      patch.transcriptDe = block.transcriptDe.replace(prefixPattern, `${name}:`);
    }
    if (block.transcriptEn) {
      patch.transcriptEn = block.transcriptEn.replace(prefixPattern, `${name}:`);
    }
    onPatch(patch);
    onTranscriptsChanged();
    setNameDrafts((drafts) => ({ ...drafts, [oldLabel]: "" }));
  }

  /** Einzelnes Segment einem anderen Sprecher zuordnen (LLM-Korrektur). */
  function assignSpeaker(index: number, speaker: string) {
    onPatch({
      transcriptCues: block.transcriptCues.map((cue, i) =>
        i === index ? { ...cue, speaker } : cue
      ),
    });
  }

  return (
    <TranscriptBox>
      <TranscriptToggle
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((o) => !o);
          setEverOpened(true);
        }}
      >
        <Chevron $open={open} aria-hidden="true">
          ▸
        </Chevron>
        {t("transcript")}
        {hasTranscript ? " ✓" : ""}
      </TranscriptToggle>

      <StatusCollapse
        $show={busy !== null}
        aria-hidden={busy === null}
        inert={busy === null}
      >
        <div>
          <StatusLine role="status" aria-live="polite">
            ⏳ {lastBusy === "transcribing" ? t("transcribing") : t("translating")}
          </StatusLine>
        </div>
      </StatusCollapse>
      {!canAuto && !hasTranscript ? (
        <p style={{ fontSize: "0.8rem", opacity: 0.65 }}>
          {t("transcribeOnlyUploads")}
        </p>
      ) : null}
      <StatusCollapse
        $show={Boolean(status?.error)}
        aria-hidden={!status?.error}
        inert={!status?.error}
      >
        <div>
          <Actions style={{ alignItems: "center" }}>
            <ErrorText role="alert">
              {lastError
                ? TRANSCRIPT_ERRORS.includes(lastError)
                  ? t(`transcriptErrors.${lastError}` as never)
                  : t("transcriptErrors.transcribe_failed")
                : null}
            </ErrorText>
            <GhostButton type="button" onClick={onRetry}>
              ↻ {t("transcriptRetry")}
            </GhostButton>
          </Actions>
        </div>
      </StatusCollapse>

      <CollapsePanel id={panelId} $open={open} inert={!open}>
        <div>
          {everOpened ? (
            <>
              <LangTabs role="tablist" aria-label={t("transcript")}>
                {(["de", "en"] as const).map((lang) => (
                  <LangTab
                    key={lang}
                    type="button"
                    role="tab"
                    aria-selected={tab === lang}
                    aria-controls={`${uid}-transcript-panel-${lang}`}
                    $active={tab === lang}
                    onClick={() => setTab(lang)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                        e.preventDefault();
                        setTab(lang === "de" ? "en" : "de");
                      }
                    }}
                  >
                    {lang === "de" ? tc("german") : tc("english")}
                    {(lang === "de" ? block.transcriptDe : block.transcriptEn).trim()
                      ? " ✓"
                      : ""}
                  </LangTab>
                ))}
              </LangTabs>

              <TabPanel
                id={`${uid}-transcript-panel-${tab}`}
                role="tabpanel"
                aria-label={
                  tab === "de" ? t("transcriptDeLabel") : t("transcriptEnLabel")
                }
              >
                <RichTextEditor
                  key={`${tab}-${version}`}
                  label={
                    tab === "de" ? t("transcriptDeLabel") : t("transcriptEnLabel")
                  }
                  value={ensureHtml(activeValue)}
                  placeholder={t("transcriptPlaceholder")}
                  onChange={(html) => onPatch({ [activeField]: html })}
                />
              </TabPanel>

              {speakerOrder.length > 0 ? (
                <SpeakerTools>
                  <SpeakerToolsTitle>{t("speakersTitle")}</SpeakerToolsTitle>
                  {speakerOrder.map((speaker) => (
                    <RenameRow key={speaker}>
                      <SpeakerNameTag>{displaySpeaker(speaker)}</SpeakerNameTag>
                      <RenameInput
                        value={nameDrafts[speaker] ?? ""}
                        placeholder={t("speakerNamePlaceholder")}
                        maxLength={40}
                        aria-label={t("speakerRenameAria", {
                          name: displaySpeaker(speaker),
                        })}
                        onChange={(e) =>
                          setNameDrafts((drafts) => ({
                            ...drafts,
                            [speaker]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            renameSpeaker(speaker);
                          }
                        }}
                      />
                      <GhostButton
                        type="button"
                        disabled={!(nameDrafts[speaker] ?? "").trim()}
                        onClick={() => renameSpeaker(speaker)}
                      >
                        {t("speakerRenameApply")}
                      </GhostButton>
                    </RenameRow>
                  ))}

                  <div>
                    <GhostButton
                      type="button"
                      aria-expanded={showSegments}
                      onClick={() => setShowSegments((v) => !v)}
                    >
                      {showSegments ? "▾" : "▸"} {t("segmentsToggle")}
                    </GhostButton>
                  </div>
                  {showSegments ? (
                    <>
                      <Muted style={{ fontSize: "0.78rem" }}>
                        {t("segmentsHint")}
                      </Muted>
                      <SegmentList aria-label={t("segmentsToggle")}>
                        {block.transcriptCues.map((cue, i) => (
                          <SegmentRow key={`${cue.start}-${i}`}>
                            <SegmentTime>{formatDuration(cue.start)}</SegmentTime>
                            <SegmentChips>
                              {speakerOrder.map((speaker) => (
                                <SpeakerChip
                                  key={speaker}
                                  type="button"
                                  $active={cue.speaker === speaker}
                                  aria-pressed={cue.speaker === speaker}
                                  onClick={() => assignSpeaker(i, speaker)}
                                >
                                  {displaySpeaker(speaker)}
                                </SpeakerChip>
                              ))}
                            </SegmentChips>
                            <SegmentText>{cue.de || cue.en}</SegmentText>
                          </SegmentRow>
                        ))}
                      </SegmentList>
                    </>
                  ) : null}
                </SpeakerTools>
              ) : null}
            </>
          ) : null}
        </div>
      </CollapsePanel>
    </TranscriptBox>
  );
}

interface LessonBlocksFormProps {
  initial: LessonDraft;
  pending: boolean;
  onSubmit: (draft: LessonDraft) => void;
  onCancel?: () => void;
  /** Alle Kurssprachen, Basissprache zuerst; >1 blendet Sprach-Tabs ein */
  languages?: string[];
  /**
   * Gespeichert wird zentral über die fixierte Speicherleiste des Editors:
   * Sie submittet dieses Formular per requestSubmit, wenn es als geändert
   * gemeldet ist. dirtyKey identifiziert das Formular (data-lesson-form).
   */
  dirtyKey?: string;
  onDirtyChange?: (key: string, dirty: boolean) => void;
}

export function LessonBlocksForm({
  initial,
  pending,
  onSubmit,
  onCancel,
  languages = ["de"],
  dirtyKey,
  onDirtyChange,
}: LessonBlocksFormProps) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [draft, setDraft] = useState<LessonDraft>(initial);
  // Index des Blocks, dessen Medien-URL gerade als Feld bearbeitet wird
  // (sonst zeigen Video-/Audio-Blöcke eine Vorschau statt der URL)
  const [urlEditing, setUrlEditing] = useState<number | null>(null);

  // Sprach-Tabs: Basissprache = Struktur + Inhalte, weitere = Übersetzungen
  const baseLang = languages[0];
  const [editLang, setEditLang] = useState(baseLang);
  const translating = editLang !== baseLang;

  const langLabel = (lang: string) =>
    lang === "de" ? tc("german") : tc("english");

  function blockTr(block: BlockDraft, lang: string): BlockTranslationDraft {
    return block.translations[lang] ?? EMPTY_BLOCK_TRANSLATION;
  }

  function patchBlockTr(
    index: number,
    lang: string,
    patch: Partial<BlockTranslationDraft>
  ) {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b, i) =>
        i === index
          ? {
              ...b,
              translations: {
                ...b.translations,
                [lang]: { ...blockTr(b, lang), ...patch },
              },
            }
          : b
      ),
    }));
  }

  /** Dauer einer übersetzten Medien-URL ermitteln (YouTube via Server). */
  async function detectTrUrlDuration(
    index: number,
    lang: string,
    url: string,
    kind: "video" | "audio"
  ) {
    if (!url) return;
    if (kind === "video" && parseYouTubeId(url)) {
      const result = await fetchYouTubeDuration(url);
      if (result.ok && result.seconds) {
        patchBlockTr(index, lang, { durationSeconds: result.seconds });
      }
      return;
    }
    const seconds = await readUrlDuration(url, kind);
    if (seconds > 0) patchBlockTr(index, lang, { durationSeconds: seconds });
  }

  const typeLabel: Record<BlockTypeName, string> = {
    VIDEO: t("typeVideo"),
    AUDIO: t("typeAudio"),
    IMAGE: t("typeImage"),
    FILE: t("typeFile"),
    TEXT: t("typeText"),
    HTML: t("typeHtml"),
  };

  function patchBlock(index: number, patch: Partial<BlockDraft>) {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  }

  /**
   * Automatische Transkription + Übersetzung nach dem Upload. Ergebnisse
   * werden per URL zugeordnet (überlebt Umsortieren der Blöcke).
   */
  const [transcripts, setTranscripts] = useState<
    Record<string, TranscriptStatus>
  >({});

  /** Übersetzt die Cue-Texte in die fehlende Sprache (best effort). */
  async function translateCues(
    cues: TranscriptCue[],
    target: "de" | "en"
  ): Promise<TranscriptCue[] | null> {
    const source = target === "en" ? "de" : "en";
    const texts = cues.map((c) => c[source]);
    const res = await translateBlockSegments({ texts, target });
    if (!res.ok || !res.texts) return null;
    const translated = res.texts;
    return cues.map((c, i) => ({ ...c, [target]: translated[i] ?? "" }));
  }

  function patchBlockByUrl(url: string, patch: Partial<BlockDraft>) {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.url === url ? { ...b, ...patch } : b)),
    }));
  }

  function setTranscriptStatus(
    url: string,
    updates: Partial<TranscriptStatus>,
    bumpVersion = false
  ) {
    setTranscripts((s) => {
      const current = s[url] ?? { state: null, error: null, version: 0 };
      return {
        ...s,
        [url]: {
          ...current,
          ...updates,
          version: bumpVersion ? current.version + 1 : current.version,
        },
      };
    });
  }

  async function autoTranscribe(url: string) {
    setTranscriptStatus(url, { state: "transcribing", error: null });

    const res = await transcribeBlockMedia({ url });
    if (!res.ok || !res.text) {
      setTranscriptStatus(url, {
        state: null,
        error: res.error ?? "transcribe_failed",
      });
      return;
    }
    const lang = res.language ?? "de";
    const html = plainTextToHtml(res.text);
    // Cues (Timestamps) in der erkannten Sprache – Basis für Karaoke
    const cues: TranscriptCue[] = (res.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      de: lang === "de" ? s.text : "",
      en: lang === "en" ? s.text : "",
      speaker: s.speaker ?? "",
    }));
    patchBlockByUrl(url, {
      ...(lang === "en" ? { transcriptEn: html } : { transcriptDe: html }),
      transcriptCues: cues,
    });
    setTranscriptStatus(url, { state: "translating", lastLang: lang }, true);

    // direkt in die jeweils andere Sprache übersetzen (Text + Cues)
    const other = lang === "en" ? "de" : "en";
    const [translated, translatedCues] = await Promise.all([
      translateBlockTranscript({ text: html, target: other }),
      cues.length > 0 ? translateCues(cues, other) : Promise.resolve(null),
    ]);
    if (!translated.ok || !translated.text) {
      // Transkript ist da – nur die Übersetzung fehlt
      setTranscriptStatus(url, {
        state: null,
        error: translated.error ?? "translate_failed",
      });
      return;
    }
    patchBlockByUrl(url, {
      ...(other === "en"
        ? { transcriptEn: translated.text }
        : { transcriptDe: translated.text }),
      // Cue-Übersetzung ist best effort – ohne sie zeigt Karaoke die Originalsprache
      ...(translatedCues ? { transcriptCues: translatedCues } : {}),
    });
    setTranscriptStatus(url, { state: null, error: null }, true);
  }

  /**
   * Retry nach Fehler: fehlt alles → komplette Pipeline; existiert schon
   * ein Transkript → nur die fehlende Übersetzung nachholen.
   */
  async function retryTranscription(block: BlockDraft) {
    const url = block.url;
    const hasDe = Boolean(block.transcriptDe.trim());
    const hasEn = Boolean(block.transcriptEn.trim());

    if (!hasDe && !hasEn) {
      await autoTranscribe(url);
      return;
    }
    if (hasDe && hasEn) {
      setTranscriptStatus(url, { state: null, error: null });
      return;
    }

    const source = hasDe ? block.transcriptDe : block.transcriptEn;
    const target: "de" | "en" = hasDe ? "en" : "de";
    // fehlen in den Cues Übersetzungen? Dann dort ebenfalls nachholen
    const cuesMissingTarget =
      block.transcriptCues.length > 0 &&
      block.transcriptCues.some((c) => !c[target].trim());
    setTranscriptStatus(url, { state: "translating", error: null });
    const [translated, translatedCues] = await Promise.all([
      translateBlockTranscript({ text: ensureHtml(source), target }),
      cuesMissingTarget
        ? translateCues(block.transcriptCues, target)
        : Promise.resolve(null),
    ]);
    if (!translated.ok || !translated.text) {
      setTranscriptStatus(url, {
        state: null,
        error: translated.error ?? "translate_failed",
      });
      return;
    }
    patchBlockByUrl(url, {
      ...(target === "en"
        ? { transcriptEn: translated.text }
        : { transcriptDe: translated.text }),
      ...(translatedCues ? { transcriptCues: translatedCues } : {}),
    });
    setTranscriptStatus(url, { state: null, error: null, lastLang: target }, true);
  }

  /** Dauer nach manueller URL-Eingabe ermitteln (YouTube via Server). */
  async function detectUrlDuration(
    index: number,
    url: string,
    kind: "video" | "audio"
  ) {
    if (!url) return;
    if (kind === "video" && parseYouTubeId(url)) {
      const result = await fetchYouTubeDuration(url);
      if (result.ok && result.seconds) {
        patchBlock(index, { durationSeconds: result.seconds });
      }
      return;
    }
    const seconds = await readUrlDuration(url, kind);
    if (seconds > 0) patchBlock(index, { durationSeconds: seconds });
  }

  const transcribing = Object.values(transcripts).some(
    (s) => s.state !== null
  );

  // Beim Verlassen warnen: Entwurf weicht vom gespeicherten Stand ab oder
  // eine Transkription läuft noch (deren Ergebnis sonst verloren ginge)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useUnsavedMarker(transcribing || dirty);

  // Änderungsstand an den Editor melden, damit die Speicherleiste weiß,
  // ob (und welches) Lektions-Formular sie mitspeichern muss
  useEffect(() => {
    if (!onDirtyChange || dirtyKey === undefined) return;
    onDirtyChange(dirtyKey, dirty);
    return () => onDirtyChange(dirtyKey, false);
  }, [dirty, dirtyKey, onDirtyChange]);

  function moveBlock(index: number, direction: -1 | 1) {
    setDraft((d) => {
      const blocks = [...d.blocks];
      const target = index + direction;
      if (target < 0 || target >= blocks.length) return d;
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...d, blocks };
    });
  }

  return (
    <Form
      data-lesson-form={dirtyKey}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        // Laufende Transkription: Speichern würde deren Ergebnis verwerfen
        if (transcribing) return;
        onSubmit(draft);
      }}
    >
      {languages.length > 1 ? (
        <LangTabs role="tablist" aria-label={t("contentLanguage")}>
          {languages.map((lang) => (
            <LangTab
              key={lang}
              type="button"
              role="tab"
              aria-selected={editLang === lang}
              $active={editLang === lang}
              onClick={() => setEditLang(lang)}
            >
              {langLabel(lang)}
            </LangTab>
          ))}
        </LangTabs>
      ) : null}

      {translating ? (
        <>
          <Muted style={{ fontSize: "0.82rem" }}>
            {t("translationHint", {
              lang: langLabel(editLang),
              base: langLabel(baseLang),
            })}
          </Muted>
          <Field
            label={`${t("lessonTitle")} · ${langLabel(editLang)}`}
            value={draft.translations[editLang]?.title ?? ""}
            placeholder={draft.title}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                translations: {
                  ...d.translations,
                  [editLang]: { title: e.target.value },
                },
              }))
            }
          />

          <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>{t("blocks")}</p>

          {draft.blocks.map((block, index) => {
            const tr = blockTr(block, editLang);
            const mediaKind = block.type === "VIDEO" ? "video" : "audio";
            return (
              <BlockPanel key={index}>
                <BlockHead>
                  <Badge $tone="violet">{index + 1}</Badge>
                  <Badge $tone="muted">{typeLabel[block.type]}</Badge>
                </BlockHead>

                <Field
                  label={`${t("blockTitle")} · ${langLabel(editLang)}`}
                  value={tr.title}
                  placeholder={block.title}
                  onChange={(e) =>
                    patchBlockTr(index, editLang, { title: e.target.value })
                  }
                />

                {block.type === "VIDEO" || block.type === "AUDIO" ? (
                  <>
                    <Field
                      label={`${block.type === "VIDEO" ? t("videoUrl") : t("audioUrl")} · ${langLabel(editLang)}`}
                      value={tr.url}
                      placeholder={block.url}
                      onChange={(e) =>
                        patchBlockTr(index, editLang, { url: e.target.value })
                      }
                      onBlur={() =>
                        void detectTrUrlDuration(
                          index,
                          editLang,
                          tr.url,
                          mediaKind
                        )
                      }
                    />
                    <BlockUpload
                      block={{ ...block, url: tr.url, fileName: tr.fileName }}
                      onUploaded={(patch) =>
                        patchBlockTr(index, editLang, {
                          ...(patch.url ? { url: patch.url } : {}),
                          ...(patch.durationSeconds !== undefined
                            ? { durationSeconds: patch.durationSeconds }
                            : {}),
                          ...(patch.poster ? { poster: patch.poster } : {}),
                        })
                      }
                    />
                    {tr.url ? (
                      <MediaPreview>
                        {block.type === "VIDEO" ? (
                          parseYouTubeId(tr.url) ? (
                            <YouTubePlayer
                              videoId={parseYouTubeId(tr.url)!}
                              title={tr.title || block.title || t("typeVideo")}
                              onTime={noop}
                              onPause={noop}
                              onEnded={noop}
                            />
                          ) : (
                            <VideoPlayer
                              src={tr.url}
                              title={tr.title || block.title || t("typeVideo")}
                              poster={tr.poster || block.poster}
                              cues={block.transcriptCues}
                              fallbackDuration={tr.durationSeconds}
                            />
                          )
                        ) : (
                          <AudioPlayer
                            src={tr.url}
                            title={tr.title || block.title || t("typeAudio")}
                            fallbackDuration={tr.durationSeconds}
                          />
                        )}
                        <MediaMetaRow>
                          {tr.durationSeconds > 0 ? (
                            <Muted style={{ fontSize: "0.8rem" }}>
                              ⏱ {formatDuration(tr.durationSeconds)}
                            </Muted>
                          ) : null}
                          <GhostButton
                            type="button"
                            onClick={() =>
                              patchBlockTr(index, editLang, {
                                url: "",
                                durationSeconds: 0,
                                poster: "",
                              })
                            }
                          >
                            ✕ {t("translationRemoveMedia")}
                          </GhostButton>
                        </MediaMetaRow>
                      </MediaPreview>
                    ) : (
                      <Muted style={{ fontSize: "0.8rem" }}>
                        {t("translationMediaFallback", {
                          base: langLabel(baseLang),
                        })}
                      </Muted>
                    )}
                  </>
                ) : null}

                {block.type === "IMAGE" ? (
                  <>
                    <Field
                      label={`${t("imageUrl")} · ${langLabel(editLang)}`}
                      value={tr.url}
                      placeholder={block.url}
                      onChange={(e) =>
                        patchBlockTr(index, editLang, { url: e.target.value })
                      }
                    />
                    <BlockUpload
                      block={{ ...block, url: tr.url, fileName: tr.fileName }}
                      onUploaded={(patch) =>
                        patchBlockTr(index, editLang, {
                          ...(patch.url ? { url: patch.url } : {}),
                        })
                      }
                    />
                    {tr.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Editor-Vorschau beliebiger URLs
                      <img
                        src={tr.url}
                        alt={tr.title || block.title || ""}
                        style={{ maxHeight: 160, borderRadius: 8 }}
                      />
                    ) : (
                      <Muted style={{ fontSize: "0.8rem" }}>
                        {t("translationMediaFallback", {
                          base: langLabel(baseLang),
                        })}
                      </Muted>
                    )}
                  </>
                ) : null}

                {block.type === "FILE" ? (
                  <>
                    <RowSplit>
                      <Field
                        label={`${t("fileUrl")} · ${langLabel(editLang)}`}
                        value={tr.url}
                        placeholder={block.url}
                        onChange={(e) =>
                          patchBlockTr(index, editLang, { url: e.target.value })
                        }
                      />
                      <Field
                        label={`${t("fileName")} · ${langLabel(editLang)}`}
                        value={tr.fileName}
                        placeholder={block.fileName}
                        onChange={(e) =>
                          patchBlockTr(index, editLang, {
                            fileName: e.target.value,
                          })
                        }
                      />
                    </RowSplit>
                    <BlockUpload
                      block={{ ...block, url: tr.url, fileName: tr.fileName }}
                      onUploaded={(patch) =>
                        patchBlockTr(index, editLang, {
                          ...(patch.url ? { url: patch.url } : {}),
                          ...(patch.fileName
                            ? { fileName: patch.fileName }
                            : {}),
                        })
                      }
                    />
                    {!tr.url ? (
                      <Muted style={{ fontSize: "0.8rem" }}>
                        {t("translationMediaFallback", {
                          base: langLabel(baseLang),
                        })}
                      </Muted>
                    ) : null}
                  </>
                ) : null}

                {block.type === "TEXT" ? (
                  <>
                    <RichTextEditor
                      label={`${t("content")} · ${langLabel(editLang)}`}
                      value={tr.content}
                      onChange={(html) =>
                        patchBlockTr(index, editLang, {
                          content: html,
                          provenance: provenanceAfterEdit(tr.provenance),
                        })
                      }
                    />
                    <ProvenanceSelect
                      value={tr.provenance}
                      onChange={(provenance) =>
                        patchBlockTr(index, editLang, { provenance })
                      }
                    />
                    <Muted style={{ fontSize: "0.8rem" }}>
                      {t("translationTextFallback", {
                        base: langLabel(baseLang),
                      })}
                    </Muted>
                  </>
                ) : null}

                {block.type === "HTML" ? (
                  <>
                    <div>
                      <p style={{ fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                        {t("htmlContent")} · {langLabel(editLang)}
                      </p>
                      <Textarea
                        aria-label={`${t("htmlContent")} · ${langLabel(editLang)}`}
                        value={tr.content}
                        onChange={(e) =>
                          patchBlockTr(index, editLang, {
                            content: e.target.value,
                            provenance: provenanceAfterEdit(tr.provenance),
                          })
                        }
                        placeholder={block.content}
                      />
                    </div>
                    <ProvenanceSelect
                      value={tr.provenance}
                      onChange={(provenance) =>
                        patchBlockTr(index, editLang, { provenance })
                      }
                    />
                    <Muted style={{ fontSize: "0.8rem" }}>
                      {t("translationTextFallback", {
                        base: langLabel(baseLang),
                      })}
                    </Muted>
                  </>
                ) : null}
              </BlockPanel>
            );
          })}
        </>
      ) : (
        <>
      <div data-error-field="title">
        <Field
          label={t("lessonTitle")}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          required
        />
      </div>

      <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>{t("blocks")}</p>

      {draft.blocks.map((block, index) => (
        <BlockPanel key={index} data-error-field={`block-${index}`}>
          <BlockHead>
            <Badge $tone="violet">{index + 1}</Badge>
            <TypeGroup role="radiogroup" aria-label={t("blockType")}>
              {(Object.keys(typeLabel) as BlockTypeName[]).map((type) => (
                <TypeOption key={type} $selected={block.type === type}>
                  <TypeRadio
                    type="radio"
                    name={`block-type-${index}`}
                    value={type}
                    checked={block.type === type}
                    aria-label={typeLabel[type]}
                    onChange={() => patchBlock(index, { type })}
                  />
                  {TYPE_ICONS[type]}
                  <TypeTip aria-hidden>{typeLabel[type]}</TypeTip>
                </TypeOption>
              ))}
            </TypeGroup>
            <span style={{ flex: 1 }} />
            <SmallButton
              type="button"
              aria-label={t("moveUp")}
              disabled={index === 0}
              onClick={() => moveBlock(index, -1)}
            >
              ↑
            </SmallButton>
            <SmallButton
              type="button"
              aria-label={t("moveDown")}
              disabled={index === draft.blocks.length - 1}
              onClick={() => moveBlock(index, 1)}
            >
              ↓
            </SmallButton>
            <SmallButton
              type="button"
              aria-label={tc("delete")}
              disabled={draft.blocks.length <= 1}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  blocks: d.blocks.filter((_, i) => i !== index),
                }))
              }
            >
              ✕
            </SmallButton>
          </BlockHead>

          <Field
            label={t("blockTitle")}
            value={block.title}
            onChange={(e) => patchBlock(index, { title: e.target.value })}
          />

          {block.type === "VIDEO" ? (
            <>
              <div data-error-field={`block-${index}-url`}>
                <SwapCollapse
                  $show={Boolean(block.url) && urlEditing !== index}
                  inert={!block.url || urlEditing === index}
                >
                  <div>
                    <MediaPreview>
                      {parseYouTubeId(block.url) ? (
                        <YouTubePlayer
                          videoId={parseYouTubeId(block.url)!}
                          title={block.title || t("typeVideo")}
                          onTime={noop}
                          onPause={noop}
                          onEnded={noop}
                        />
                      ) : block.url ? (
                        <VideoPlayer
                          src={block.url}
                          title={block.title || t("typeVideo")}
                          poster={block.poster}
                          cues={block.transcriptCues}
                          fallbackDuration={block.durationSeconds}
                        />
                      ) : null}
                      <MediaMetaRow>
                        {block.durationSeconds > 0 ? (
                          <Muted style={{ fontSize: "0.8rem" }}>
                            ⏱ {formatDuration(block.durationSeconds)}
                          </Muted>
                        ) : null}
                        <GhostButton
                          type="button"
                          onClick={() => setUrlEditing(index)}
                        >
                          🔗 {t("changeMediaUrl")}
                        </GhostButton>
                      </MediaMetaRow>
                    </MediaPreview>
                  </div>
                </SwapCollapse>
                <SwapCollapse
                  $show={!block.url || urlEditing === index}
                  inert={Boolean(block.url) && urlEditing !== index}
                >
                  <div>
                    <Field
                      label={t("videoUrl")}
                      value={block.url}
                      onChange={(e) =>
                        patchBlock(index, { url: e.target.value })
                      }
                      onBlur={() => {
                        setUrlEditing(null);
                        void detectUrlDuration(index, block.url, "video");
                      }}
                      placeholder="https://youtube.com/watch?v=… oder /uploads/…"
                    />
                  </div>
                </SwapCollapse>
              </div>
              <BlockUpload
                block={block}
                onUploaded={(patch) => {
                  patchBlock(index, patch);
                  // nach dem Upload automatisch transkribieren + übersetzen
                  if (patch.url) void autoTranscribe(patch.url);
                }}
              />
              <PosterPicker
                block={block}
                onPatch={(patch) => patchBlock(index, patch)}
              />
              <TranscriptEditor
                block={block}
                status={transcripts[block.url]}
                onPatch={(patch) => patchBlock(index, patch)}
                onRetry={() => void retryTranscription(block)}
                onTranscriptsChanged={() =>
                  setTranscriptStatus(block.url, {}, true)
                }
              />
              <ChapterEditor
                block={block}
                baseLang={languages[0] ?? "de"}
                onPatch={(patch) => patchBlock(index, patch)}
              />
            </>
          ) : null}

          {block.type === "AUDIO" ? (
            <>
              <div data-error-field={`block-${index}-url`}>
                <SwapCollapse
                  $show={Boolean(block.url) && urlEditing !== index}
                  inert={!block.url || urlEditing === index}
                >
                  <div>
                    <MediaPreview>
                      {block.url ? (
                        <AudioPlayer
                          src={block.url}
                          title={block.title || t("typeAudio")}
                          fallbackDuration={block.durationSeconds}
                        />
                      ) : null}
                      <MediaMetaRow>
                        {block.durationSeconds > 0 ? (
                          <Muted style={{ fontSize: "0.8rem" }}>
                            ⏱ {formatDuration(block.durationSeconds)}
                          </Muted>
                        ) : null}
                        <GhostButton
                          type="button"
                          onClick={() => setUrlEditing(index)}
                        >
                          🔗 {t("changeMediaUrl")}
                        </GhostButton>
                      </MediaMetaRow>
                    </MediaPreview>
                  </div>
                </SwapCollapse>
                <SwapCollapse
                  $show={!block.url || urlEditing === index}
                  inert={Boolean(block.url) && urlEditing !== index}
                >
                  <div>
                    <Field
                      label={t("audioUrl")}
                      value={block.url}
                      onChange={(e) =>
                        patchBlock(index, { url: e.target.value })
                      }
                      onBlur={() => {
                        setUrlEditing(null);
                        void detectUrlDuration(index, block.url, "audio");
                      }}
                    />
                  </div>
                </SwapCollapse>
              </div>
              <BlockUpload
                block={block}
                onUploaded={(patch) => {
                  patchBlock(index, patch);
                  // nach dem Upload automatisch transkribieren + übersetzen
                  if (patch.url) void autoTranscribe(patch.url);
                }}
              />
              <TranscriptEditor
                block={block}
                status={transcripts[block.url]}
                onPatch={(patch) => patchBlock(index, patch)}
                onRetry={() => void retryTranscription(block)}
                onTranscriptsChanged={() =>
                  setTranscriptStatus(block.url, {}, true)
                }
              />
              <ChapterEditor
                block={block}
                baseLang={languages[0] ?? "de"}
                onPatch={(patch) => patchBlock(index, patch)}
              />
            </>
          ) : null}

          {block.type === "IMAGE" ? (
            <>
              <div data-error-field={`block-${index}-url`}>
                <Field
                  label={t("imageUrl")}
                  value={block.url}
                  onChange={(e) => patchBlock(index, { url: e.target.value })}
                  required
                />
              </div>
              <BlockUpload
                block={block}
                onUploaded={(patch) => patchBlock(index, patch)}
              />
              {block.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Editor-Vorschau beliebiger URLs
                <img
                  src={block.url}
                  alt={block.title || ""}
                  style={{ maxHeight: 160, borderRadius: 8 }}
                />
              ) : null}
            </>
          ) : null}

          {block.type === "FILE" ? (
            <>
              <RowSplit>
                <div data-error-field={`block-${index}-url`}>
                  <Field
                    label={t("fileUrl")}
                    value={block.url}
                    onChange={(e) => patchBlock(index, { url: e.target.value })}
                    required
                  />
                </div>
                <Field
                  label={t("fileName")}
                  value={block.fileName}
                  onChange={(e) =>
                    patchBlock(index, { fileName: e.target.value })
                  }
                />
              </RowSplit>
              <BlockUpload
                block={block}
                onUploaded={(patch) => patchBlock(index, patch)}
              />
            </>
          ) : null}

          {block.type === "TEXT" ? (
            <div data-error-field={`block-${index}-content`}>
              <RichTextEditor
                label={t("content")}
                value={block.content}
                onChange={(html) =>
                  // Bearbeiten stuft KI-Inhalte automatisch auf "angepasst" um
                  patchBlock(index, {
                    content: html,
                    provenance: provenanceAfterEdit(block.provenance),
                  })
                }
              />
              <ProvenanceSelect
                value={block.provenance}
                onChange={(provenance) => patchBlock(index, { provenance })}
              />
            </div>
          ) : null}

          {block.type === "HTML" ? (
            <>
              <div data-error-field={`block-${index}-content`}>
                <p style={{ fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                  {t("htmlContent")}
                </p>
                <Textarea
                  aria-label={t("htmlContent")}
                  value={block.content}
                  onChange={(e) =>
                    // Bearbeiten stuft KI-Inhalte automatisch um
                    patchBlock(index, {
                      content: e.target.value,
                      provenance: provenanceAfterEdit(block.provenance),
                    })
                  }
                  placeholder="<h1>Hallo Mittelerde</h1>"
                  required
                />
                <ProvenanceSelect
                  value={block.provenance}
                  onChange={(provenance) => patchBlock(index, { provenance })}
                />
              </div>
              <div>
                <p style={{ fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                  {t("cssContent")}
                </p>
                <Textarea
                  aria-label={t("cssContent")}
                  value={block.css}
                  onChange={(e) => patchBlock(index, { css: e.target.value })}
                  placeholder="h1 { color: rebeccapurple; }"
                />
              </div>
            </>
          ) : null}
        </BlockPanel>
      ))}

      <Actions>
        <GhostButton
          type="button"
          data-error-field="add-block"
          onClick={() =>
            setDraft((d) => ({ ...d, blocks: [...d.blocks, { ...EMPTY_BLOCK }] }))
          }
        >
          + {t("addBlock")}
        </GhostButton>
      </Actions>

      <CheckboxRow>
        <input
          type="checkbox"
          checked={draft.isPreview}
          onChange={(e) => setDraft({ ...draft, isPreview: e.target.checked })}
        />
        {t("isPreviewLesson")}
      </CheckboxRow>
        </>
      )}

      {/* Kein eigener Speichern-Button: die fixierte Leiste des Editors
          speichert Einstellungen und offene Lektionen gemeinsam */}
      <Actions>
        {onCancel ? (
          <DangerButton type="button" onClick={onCancel} disabled={pending}>
            {tc("cancel")}
          </DangerButton>
        ) : null}
        {transcribing ? (
          <span
            role="status"
            style={{ fontSize: "0.82rem", opacity: 0.7, alignSelf: "center" }}
          >
            {t("transcriptWait")}
          </span>
        ) : null}
      </Actions>
    </Form>
  );
}
