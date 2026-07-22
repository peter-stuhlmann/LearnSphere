"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type DragEvent,
  type FormEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { AssistantCoverage } from "./AssistantCoverage";
import { Link, useRouter } from "@/i18n/navigation";
import {
  addLesson,
  addSection,
  deleteCourse,
  deleteLesson,
  deleteSection,
  moveLesson,
  moveLessonTo,
  moveSection,
  renameSection,
  reorderSections,
  setCoursePublished,
  updateCourse,
  updateLesson,
  updateSectionDrip,
  updateSectionTranslations,
} from "@/app/actions/course-actions";
import {
  COURSE_LANGUAGES,
  type CourseTranslationDraft,
} from "@elearning/core/course-i18n";
import {
  Badge,
  Card,
  Container,
  DangerButton,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { TagInput } from "@/components/ui/TagInput";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { COURSE_CATEGORIES } from "@elearning/core/categories";
import { RichTextEditor } from "@/components/ui/RichTextEditorLazy";
import { useUnsavedMarker } from "@/components/ui/UnsavedChangesGuard";
import { useThrottledValue } from "@/lib/useThrottledValue";
import { formatPrice } from "@elearning/core/format";
import { CREATOR_SHARE_PERCENT, creatorShareCents } from "@elearning/core/revenue";
import { MIN_PRICE_CENTS } from "@elearning/core/validation";
import { CoursePreview } from "./CoursePreview";
import { SelfTestManager } from "./SelfTestManager";
import {
  improveCourseText,
  suggestCourseField,
} from "@/app/actions/copilot-actions";
import type { CopilotField } from "@/lib/copilot";
import { FormAlert } from "@/components/auth/AuthShell";
import {
  EMPTY_LESSON,
  LessonBlocksForm,
  type BlockDraft,
  type LessonDraft,
} from "./LessonBlocksForm";

const Wrap = styled.main`
  /* unten Platz für die fixe Speichern-Leiste */
  padding: 4rem 0 7rem;

  /* Der in der Speicherleiste gezeigte Fehler markiert sein Feld rot */
  [data-error-highlight] {
    outline: 2px solid ${({ theme }) => theme.colors.danger};
    outline-offset: 4px;
    border-radius: ${({ theme }) => theme.radii.md};
  }
`;

/* Speichern immer griffbereit: fixe Leiste am unteren Viewport-Rand */
const SaveBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(7, 8, 15, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 0.75rem 20px calc(0.75rem + env(safe-area-inset-bottom));
`;

const SaveBarInner = styled.div`
  max-width: ${({ theme }) => theme.maxWidth};
  margin-inline: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem 1rem;

  > span {
    font-size: 0.82rem;
    color: ${({ theme }) => theme.colors.textMuted};

    &::before {
      content: "●";
      margin-right: 0.4rem;
      color: ${({ theme }) => theme.colors.accent};
    }
  }
`;

/* Erfolg/Fehler direkt in der Speicherleiste – immer im Blick, egal wo man
   gerade scrollt. Nimmt links den freien Platz, bricht auf Mobile um. */
const BarMessage = styled.div<{ $tone: "success" | "error" }>`
  flex: 1 1 16rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: ${({ theme, $tone }) =>
    $tone === "success" ? theme.colors.success : theme.colors.danger};
`;

/* Blättern zwischen mehreren Fehlern (auch per Pfeiltasten) */
const ErrorNav = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
`;

const ErrorNavButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.colors.danger};
  background: ${({ theme }) => theme.colors.dangerSoft};
  color: ${({ theme }) => theme.colors.danger};
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.danger};
    color: ${({ theme }) => theme.colors.bgDeep};
  }
`;

const ErrorCount = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  min-width: 2.2rem;
  text-align: center;
`;

/* Speichern-Button mit Erledigt-Zustand: ohne Änderungen wird er zum
   grünen "Gespeichert!"-Badge statt zum tot wirkenden disabled-Button */
const SaveButton = styled(PrimaryButton)<{ $saved: boolean }>`
  ${({ $saved, theme }) =>
    $saved &&
    `
    &:disabled {
      opacity: 1;
      background: ${theme.colors.successSoft};
      color: ${theme.colors.success};
      cursor: default;
    }
  `}
`;

const HeadRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
`;

const Grid = styled.div`
  display: grid;
  gap: 1.5rem;
  margin-top: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 380px 1fr;
    align-items: start;
  }
`;

const SettingsForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const CoverFrame = styled.div<{ $empty: boolean }>`
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: ${({ theme }) => theme.radii.md};
  overflow: hidden;
  border: 1px ${({ $empty }) => ($empty ? "dashed" : "solid")}
    ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgElevated};
  display: grid;
  place-items: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

/**
 * Aktionen + Hinweis liegen als Overlay auf dem Kursbild: eingeblendet
 * beim Hovern bzw. per Tastatur-Fokus; ohne Hover (Touch) und bei leerem
 * Cover dauerhaft sichtbar.
 */
const CoverOverlay = styled.div<{ $empty: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1rem;
  text-align: center;
  background: linear-gradient(
    to top,
    rgba(7, 8, 15, 0.85),
    rgba(7, 8, 15, 0.45) 55%,
    rgba(7, 8, 15, 0.25)
  );
  opacity: ${({ $empty }) => ($empty ? 1 : 0)};
  transition: opacity 200ms ease;

  ${CoverFrame}:hover &,
  &:focus-within {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  /* Buttons auf dem Bild: Milchglas statt durchscheinendem Motiv */
  button {
    background: rgba(7, 8, 15, 0.55);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-color: rgba(242, 243, 250, 0.25);
    color: #f2f3fa;

    &:hover:not(:disabled) {
      background: rgba(7, 8, 15, 0.75);
      border-color: rgba(242, 243, 250, 0.45);
    }
  }

  p {
    font-size: 0.75rem;
    color: rgba(242, 243, 250, 0.85);
    max-width: 42ch;
    margin: 0;
    text-shadow: 0 1px 8px rgba(7, 8, 15, 0.8);
  }
`;

const PriceSegment = styled.div`
  display: flex;
  padding: 0.25rem;
  gap: 0.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.bgElevated};
`;

const PriceSegButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 0.55rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.88rem;
  transition: background 160ms ease, color 160ms ease;
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

const CoverActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
`;

const ShareHint = styled.dl`
  /* direkt unterm Preisfeld: was der Creator pro Verkauf verdient – kompakt als Label→Betrag */
  margin-top: -0.5rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.15rem 1rem;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textMuted};

  dt {
    margin: 0;
  }

  dd {
    margin: 0;
    justify-self: end;
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
  }
`;

const LabelText = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  display: block;
  margin-bottom: 0.4rem;
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

const CheckboxHint = styled.p`
  margin: -0.5rem 0 0 calc(18px + 0.6rem);
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.accent};
`;

const LangChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const LangChip = styled.button<{ $active: boolean }>`
  padding: 0.45rem 1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.85rem;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? "rgba(200, 255, 77, 0.5)" : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.textMuted};

  &:disabled {
    cursor: default;
  }

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

/** Übersetzungsbereich in den Einstellungen (Titel/Untertitel/Beschreibung) */
const TransBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px dashed ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};
`;

const TransTabs = styled.div`
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.2rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  align-self: flex-start;
`;

const TransTab = styled.button<{ $active: boolean }>`
  padding: 0.35rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.8rem;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accent : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.onAccent : theme.colors.textMuted};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const SectionCard = styled(Card)<{ $dropActive?: boolean; $dragging?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: opacity 150ms ease, outline-color 150ms ease;
  outline: 2px dashed
    ${({ theme, $dropActive }) =>
      $dropActive ? theme.colors.accent : "transparent"};
  outline-offset: 4px;
  opacity: ${({ $dragging }) => ($dragging ? 0.45 : 1)};
`;

/* Drag-and-drop: Griff zum Umsortieren von Abschnitten und Lektionen.
   Die ↑/↓-Buttons bleiben als tastaturbedienbare Alternative erhalten. */
const DragHandle = styled.span`
  cursor: grab;
  user-select: none;
  touch-action: none;
  color: ${({ theme }) => theme.colors.textFaint};
  font-size: 0.9rem;
  letter-spacing: -0.08em;
  padding: 0.2rem 0.3rem;
  border-radius: ${({ theme }) => theme.radii.sm};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface};
  }

  &:active {
    cursor: grabbing;
  }
`;

const SectionHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;

  h3 {
    font-size: 1.15rem;
    flex: 1;
    min-width: 150px;
  }
`;

const EditableTitle = styled.h3`
  cursor: text;
  padding: 0.15em 0.35em;
  margin-left: -0.35em;
  border-radius: ${({ theme }) => theme.radii.sm};
  transition: background 140ms ease;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
  }
`;

const TitleInput = styled.input`
  flex: 1;
  min-width: 150px;
  font-family: inherit;
  font-size: 1.15rem;
  font-weight: inherit;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.accent};
  border-radius: ${({ theme }) => theme.radii.sm};
  padding: 0.15em 0.35em;
  margin-left: -0.35em;

  &:focus-visible {
    outline: none;
  }
`;

/* ✦-Button am Feld: holt einen KI-Vorschlag für genau dieses Feld */
const AiButton = styled.button`
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid rgba(139, 124, 255, 0.45);
  color: ${({ theme }) => theme.colors.violet};
  font-size: 0.85rem;
  transition: border-color 150ms ease, background 150ms ease;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.violet};
    background: ${({ theme }) => theme.colors.violetSoft};
  }

  &:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

export const IconButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.85rem;

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.text};
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  &:disabled {
    opacity: 0.35;
  }
`;

const LessonRow = styled.div<{ $dropActive?: boolean; $dragging?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  transition: opacity 150ms ease, box-shadow 150ms ease;
  box-shadow: ${({ theme, $dropActive }) =>
    $dropActive ? `0 -2px 0 0 ${theme.colors.accent}` : "none"};
  opacity: ${({ $dragging }) => ($dragging ? 0.45 : 1)};

  strong {
    flex: 1;
    min-width: 140px;
    font-weight: 500;
    font-size: 0.94rem;
  }
`;

const InlineForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px dashed ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};
`;

const RowSplit = styled.div`
  display: grid;
  gap: 0.8rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const ViewLiveLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.5rem 1.1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  color: ${({ theme }) => theme.colors.text};
  transition: border-color 150ms ease, color 150ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const QuizLinkBase = styled(Link)`
  color: ${({ theme }) => theme.colors.violet};
  font-size: 0.88rem;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

/**
 * Links zu Editor-Unterseiten (Prüfungen, Gutscheine, Zertifikat): gehören
 * zum Bearbeitungsfluss, darum kein Unsaved-Dialog – der Einstellungs-
 * Entwurf übersteht die Navigation als sessionStorage-Draft.
 */
function QuizLink(props: ComponentProps<typeof QuizLinkBase>) {
  return <QuizLinkBase {...props} data-allow-unsaved="" />;
}

export interface EditorLesson {
  id: string;
  title: string;
  isPreview: boolean;
  durationSeconds: number;
  blocks: BlockDraft[];
  translations: Record<string, { title: string }>;
}

interface EditorSection {
  id: string;
  title: string;
  quiz: { id: string; title: string } | null;
  /** Drip Content: frühestens X Tage nach Einschreibung (null = sofort) */
  dripAfterDays: number | null;
  /** Drip Content: erst nach Zwischenprüfung des vorherigen Abschnitts */
  dripAfterQuiz: boolean;
  lessons: EditorLesson[];
  translations: Record<string, { title: string }>;
}

interface EditorCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  language: "de" | "en";
  /** Zusatzsprachen des Kurses (ohne Basissprache) */
  extraLanguages: string[];
  translations: Record<string, CourseTranslationDraft>;
  priceCents: number;
  published: boolean;
  listedInShop: boolean;
  /** Warteliste: "Demnächst"-Seite mit E-Mail-Eintragung (vor Veröffentlichung) */
  waitlistEnabled: boolean;
  enrollmentCount: number;
  requiredWatchPercent: number;
  finalExamRequired: boolean;
  selfTestsEnabled: boolean;
  /** Live-Termine (termine.lol): Checkbox "Termine anbieten" */
  bookingEnabled: boolean;
  /** Kurs ist per Connect-Flow mit termine.lol verbunden (Key bleibt serverseitig) */
  bookingConnected: boolean;
  category: string | null;
  tags: string[];
  coverImage: string | null;
  finalQuiz: { id: string; title: string } | null;
  sections: EditorSection[];
}

/** BlockDrafts in Action-Input überführen (Zahlen normalisieren). */
function draftToInput(draft: LessonDraft) {
  return {
    title: draft.title,
    isPreview: draft.isPreview,
    translations: draft.translations,
    blocks: draft.blocks.map((block) => ({
      ...block,
      durationSeconds: Math.max(
        0,
        Math.floor(Number(block.durationSeconds) || 0)
      ),
      // Kapitel ohne Titel sind unfertige Zeilen → nicht speichern
      chapters: block.chapters
        .filter((chapter) => chapter.title.trim().length > 0)
        .map((chapter) => ({
          t: Math.max(0, Math.floor(Number(chapter.t) || 0)),
          title: chapter.title.trim(),
        })),
      translations: Object.fromEntries(
        Object.entries(block.translations).map(([lang, tr]) => [
          lang,
          {
            ...tr,
            durationSeconds: Math.max(
              0,
              Math.floor(Number(tr.durationSeconds) || 0)
            ),
          },
        ])
      ),
    })),
  };
}

const LESSON_ERROR_KEYS = [
  "lesson_needs_block",
  "url_required",
  "url_invalid",
  "content_required",
  "title_too_short",
];

/* ---------- Fehler mit Feldbezug für die fixierte Speicherleiste ---------- */

/** Ziel eines Fehlers: Lektions-Formular (form) und/oder Feld-Slot darin */
interface ErrorField {
  form?: string;
  slot?: string;
}

interface EditorError {
  text: string;
  field?: ErrorField;
}

/** DOM-Element zum Fehler finden (data-lesson-form / data-error-field) */
function resolveErrorTarget(field: ErrorField): HTMLElement | null {
  if (field.form) {
    const form = document.querySelector<HTMLElement>(
      `form[data-lesson-form="${CSS.escape(field.form)}"]`
    );
    if (!form) return null;
    if (!field.slot) return form;
    const exact = form.querySelector<HTMLElement>(
      `[data-error-field="${CSS.escape(field.slot)}"]`
    );
    if (exact) return exact;
    // "block-2-url" nicht gefunden → wenigstens den Block markieren
    const blockAnchor = field.slot.match(/^(block-\d+)-/);
    if (blockAnchor) {
      const block = form.querySelector<HTMLElement>(
        `[data-error-field="${blockAnchor[1]}"]`
      );
      if (block) return block;
    }
    return form;
  }
  if (!field.slot) return null;
  return document.querySelector<HTMLElement>(
    `[data-error-field="${CSS.escape(field.slot)}"]`
  );
}

/** Zod-Fehlerpfad → präzises Feld im Lektions-Formular */
function lessonErrorField(
  formKey: string,
  path?: (string | number)[]
): ErrorField {
  if (!path || path.length === 0) return { form: formKey };
  if (path[0] === "title") return { form: formKey, slot: "title" };
  if (path[0] === "blocks") {
    // lesson_needs_block (Pfad ["blocks"]) → der "+ Block"-Button ist das Ziel
    if (typeof path[1] !== "number")
      return { form: formKey, slot: "add-block" };
    const slot =
      path[2] === "url" || path[2] === "content"
        ? `block-${path[1]}-${path[2]}`
        : `block-${path[1]}`;
    return { form: formKey, slot };
  }
  return { form: formKey };
}

/** Formularzustand aus dem Server-Kurs – dient auch als "gespeicherte" Basis */
function settingsFromCourse(course: EditorCourse) {
  return {
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    language: course.language,
    extraLanguages: course.extraLanguages,
    translations: course.translations,
    priceCents: course.priceCents,
    requiredWatchPercent: course.requiredWatchPercent,
    finalExamRequired: course.finalExamRequired,
    selfTestsEnabled: course.selfTestsEnabled,
    listedInShop: course.listedInShop,
    waitlistEnabled: course.waitlistEnabled,
    category: course.category ?? "",
    tags: course.tags,
    coverImage: course.coverImage ?? "",
    bookingEnabled: course.bookingEnabled,
  };
}

/**
 * Zahlenfelder normalisieren, damit "2999" und 2999 als gleich gelten.
 * Bewusst Feld für Feld statt Spread: alte sessionStorage-Entwürfe können
 * längst entfernte Schlüssel enthalten – die dürfen den Vergleich mit dem
 * Server-Stand nicht dauerhaft als "ungespeichert" erscheinen lassen.
 */
function serializeSettings(s: ReturnType<typeof settingsFromCourse>): string {
  return JSON.stringify({
    title: s.title,
    subtitle: s.subtitle,
    description: s.description,
    language: s.language,
    extraLanguages: s.extraLanguages,
    translations: s.translations,
    priceCents: Math.round(Number(s.priceCents)),
    requiredWatchPercent: Number(s.requiredWatchPercent),
    finalExamRequired: s.finalExamRequired,
    selfTestsEnabled: s.selfTestsEnabled,
    listedInShop: s.listedInShop,
    waitlistEnabled: s.waitlistEnabled,
    category: s.category,
    tags: s.tags,
    coverImage: s.coverImage,
    bookingEnabled: s.bookingEnabled,
  });
}

/**
 * Übersetzte Abschnittstitel: kleines Auf-/Zuklapp-Panel je Abschnitt,
 * speichert unabhängig von den Kurs-Einstellungen.
 */
function SectionTranslations({
  section,
  extraLanguages,
  pending,
  onSave,
}: {
  section: EditorSection;
  extraLanguages: string[];
  pending: boolean;
  onSave: (drafts: Record<string, { title: string }>) => void;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      extraLanguages.map((lang) => [
        lang,
        section.translations[lang]?.title ?? "",
      ])
    )
  );

  return (
    <div>
      <GhostButton
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        🌐 {t("sectionTranslations")}
        {extraLanguages.some((lang) => section.translations[lang]?.title)
          ? " ✓"
          : ""}
      </GhostButton>
      {open ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            marginTop: "0.6rem",
          }}
        >
          {extraLanguages.map((lang) => (
            <Field
              key={lang}
              label={`${t("sectionTitle")} · ${lang === "de" ? "Deutsch" : "English"}`}
              placeholder={section.title}
              value={drafts[lang] ?? ""}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, [lang]: e.target.value }))
              }
            />
          ))}
          <GhostButton
            type="button"
            disabled={pending}
            style={{ alignSelf: "flex-start" }}
            onClick={() =>
              onSave(
                Object.fromEntries(
                  extraLanguages.map((lang) => [
                    lang,
                    { title: (drafts[lang] ?? "").trim() },
                  ])
                )
              )
            }
          >
            {tc("save")}
          </GhostButton>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Drip Content je Abschnitt: kleines Auf-/Zuklapp-Panel – Freischaltung
 * nach X Tagen und/oder nach der Zwischenprüfung des vorherigen Abschnitts.
 * Beides optional und kombinierbar; speichert unabhängig vom Rest.
 */
function SectionDripSettings({
  section,
  isFirst,
  pending,
  onSave,
}: {
  section: EditorSection;
  isFirst: boolean;
  pending: boolean;
  onSave: (drip: { dripAfterDays: number | null; dripAfterQuiz: boolean }) => void;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(
    section.dripAfterDays ? String(section.dripAfterDays) : ""
  );
  const [afterQuiz, setAfterQuiz] = useState(section.dripAfterQuiz);

  const active = (section.dripAfterDays ?? 0) > 0 || section.dripAfterQuiz;

  return (
    <div>
      <GhostButton
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        🔒 {t("dripSettings")}
        {active ? " ✓" : ""}
      </GhostButton>
      {open ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            marginTop: "0.6rem",
          }}
        >
          <Field
            label={t("dripDaysLabel")}
            hint={t("dripDaysHint")}
            type="number"
            min={0}
            max={365}
            placeholder="0"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          {!isFirst ? (
            <CheckboxRow>
              <input
                type="checkbox"
                checked={afterQuiz}
                onChange={(e) => setAfterQuiz(e.target.checked)}
              />
              {t("dripQuizLabel")}
            </CheckboxRow>
          ) : null}
          <GhostButton
            type="button"
            disabled={pending}
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              const parsed = Math.max(
                0,
                Math.min(365, Math.floor(Number(days) || 0))
              );
              onSave({
                dripAfterDays: parsed > 0 ? parsed : null,
                dripAfterQuiz: isFirst ? false : afterQuiz,
              });
            }}
          >
            {tc("save")}
          </GhostButton>
        </div>
      ) : null}
    </div>
  );
}

export function CourseEditor({
  course,
  creatorName,
}: {
  course: EditorCourse;
  creatorName: string;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  /* Fehler sammeln sich pro Speichervorgang (mehrere Formulare können
     gleichzeitig scheitern); durchblätterbar in der Speicherleiste */
  const [errors, setErrors] = useState<EditorError[]>([]);
  const [errorIndex, setErrorIndex] = useState(0);

  const shownErrorIndex = Math.min(errorIndex, Math.max(errors.length - 1, 0));
  const activeError = errors[shownErrorIndex] ?? null;

  function stepError(delta: number) {
    if (errors.length < 2) return;
    setErrorIndex((shownErrorIndex + delta + errors.length) % errors.length);
  }

  /* Drag-and-drop-Umsortierung: Abschnitte untereinander, Lektionen auch
     über Abschnittsgrenzen hinweg. Die ↑/↓-Buttons bleiben als
     tastaturbedienbare Alternative bestehen. */
  type DragItem =
    | { kind: "section"; id: string }
    | { kind: "lesson"; id: string; fromSection: string };
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);

  function startDrag(event: DragEvent, item: DragItem) {
    event.dataTransfer.setData("text/plain", item.id);
    event.dataTransfer.effectAllowed = "move";
    setDrag(item);
  }

  function endDrag() {
    setDrag(null);
    setDropKey(null);
  }

  function clearDropKey(key: string) {
    setDropKey((current) => (current === key ? null : current));
  }

  function onDragOverSection(event: DragEvent, sectionId: string) {
    if (!drag) return;
    if (drag.kind === "section" && drag.id === sectionId) return;
    event.preventDefault();
    setDropKey(`section:${sectionId}`);
  }

  function onDropSection(event: DragEvent, sectionId: string) {
    const item = drag;
    if (!item) return;
    event.preventDefault();
    if (item.kind === "section") {
      if (item.id !== sectionId) {
        const ids = course.sections
          .map((s) => s.id)
          .filter((id) => id !== item.id);
        ids.splice(ids.indexOf(sectionId), 0, item.id);
        run(() => reorderSections(course.id, ids));
      }
    } else {
      // Lektion ans Ende des Ziel-Abschnitts
      const count =
        course.sections
          .find((s) => s.id === sectionId)
          ?.lessons.filter((l) => l.id !== item.id).length ?? 0;
      run(() => moveLessonTo(item.id, sectionId, count));
    }
    endDrag();
  }

  function onDragOverLesson(event: DragEvent, lessonId: string) {
    if (!drag || drag.kind !== "lesson" || drag.id === lessonId) return;
    event.preventDefault();
    event.stopPropagation();
    setDropKey(`lesson:${lessonId}`);
  }

  function onDropLesson(
    event: DragEvent,
    sectionId: string,
    lessonId: string
  ) {
    const item = drag;
    if (!item || item.kind !== "lesson") return;
    event.preventDefault();
    event.stopPropagation();
    if (item.id !== lessonId) {
      const ids = (
        course.sections.find((s) => s.id === sectionId)?.lessons ?? []
      )
        .map((l) => l.id)
        .filter((id) => id !== item.id);
      run(() => moveLessonTo(item.id, sectionId, ids.indexOf(lessonId)));
    }
    endDrag();
  }

  function onDragOverSectionEnd(event: DragEvent) {
    if (drag?.kind !== "section") return;
    event.preventDefault();
    setDropKey("section-end");
  }

  function onDropSectionEnd(event: DragEvent) {
    const item = drag;
    if (item?.kind !== "section") return;
    event.preventDefault();
    const ids = course.sections
      .map((s) => s.id)
      .filter((id) => id !== item.id);
    ids.push(item.id);
    run(() => reorderSections(course.id, ids));
    endDrag();
  }

  // Der gerade angezeigte Fehler markiert sein Feld rot und scrollt es
  // in den sichtbaren Bereich; beim Weiterblättern wandert die Markierung
  useEffect(() => {
    const field = activeError?.field;
    if (!field) return;
    const el = resolveErrorTarget(field);
    if (!el) return;
    el.setAttribute("data-error-highlight", "");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return () => el.removeAttribute("data-error-highlight");
  }, [activeError]);
  /* Kurzlebige Bestätigung direkt nach dem Speichern – bewusst NICHT der
     Dauerzustand "alles gespeichert", der wirkt beim Seitenaufruf irritierend */
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [justSaved]);

  // Erfolgsmeldungen in der Leiste räumen sich selbst auf; Fehler bleiben,
  // bis sie behoben sind oder die nächste Aktion sie ersetzt
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  // Hinweis, wenn jemand einen kostenlosen Kurs aus dem Shop nehmen will
  const [shopLockHint, setShopLockHint] = useState(false);

  const [settings, setSettings] = useState(() => settingsFromCourse(course));

  // Kurs-Copilot: gezielter KI-Vorschlag je Feld (✦-Button am Feld)
  const [aiField, setAiField] = useState<CopilotField | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  function copilotErrorText(code?: string): string {
    switch (code) {
      case "not_enough_content":
        return t("copilotNotEnough");
      case "rate_limited":
        return t("copilotRateLimited");
      case "unavailable":
        return t("copilotUnavailable");
      default:
        return t("copilotFailed");
    }
  }

  function suggestField(field: CopilotField) {
    if (aiField) return;
    setAiField(field);
    setAiError(null);
    void (async () => {
      const result = await suggestCourseField({ courseId: course.id, field });
      setAiField(null);
      if (!result.ok || result.value === undefined) {
        setAiError(copilotErrorText(result.error));
        return;
      }
      const value = result.value;
      setSettings((s) =>
        field === "title"
          ? { ...s, title: value as string }
          : field === "subtitle"
            ? { ...s, subtitle: value as string }
            : field === "description"
              ? { ...s, description: value as string }
              : { ...s, tags: value as string[] }
      );
    })();
  }

  /** Bubble-Menü der Beschreibung: markierten Text per KI verbessern */
  async function improveDescriptionSelection(
    text: string
  ): Promise<string | null> {
    setAiError(null);
    const result = await improveCourseText({
      text,
      lang: settings.language,
    });
    if (!result.ok || !result.value) {
      setAiError(copilotErrorText(result.error));
      return null;
    }
    return result.value;
  }

  // Aktiver Übersetzungs-Tab in den Einstellungen (nur Zusatzsprachen)
  const [transLang, setTransLang] = useState<string | null>(null);
  const activeTransLang = settings.extraLanguages.includes(transLang ?? "")
    ? (transLang as string)
    : (settings.extraLanguages[0] ?? null);
  /** Alle Kurssprachen, Basissprache zuerst – steuert die Sprach-Tabs */
  const courseLangs = [settings.language, ...settings.extraLanguages];

  const langName = (lang: string) => (lang === "de" ? "Deutsch" : "English");

  function toggleExtraLanguage(lang: string) {
    if (lang === settings.language) return;
    setSettings((s) => {
      if (s.extraLanguages.includes(lang)) {
        // Sprache deaktivieren: zugehörige Übersetzungen mit entfernen
        const translations = { ...s.translations };
        delete translations[lang];
        return {
          ...s,
          extraLanguages: s.extraLanguages.filter((l) => l !== lang),
          translations,
        };
      }
      return { ...s, extraLanguages: [...s.extraLanguages, lang] };
    });
  }

  function patchTranslation(
    lang: string,
    patch: Partial<CourseTranslationDraft>
  ) {
    setSettings((s) => ({
      ...s,
      translations: {
        ...s.translations,
        [lang]: {
          ...(s.translations[lang] ?? {
            title: "",
            subtitle: "",
            description: "",
          }),
          ...patch,
        },
      },
    }));
  }
  // Beim Verlassen warnen, solange die Einstellungen vom gespeicherten
  // Stand abweichen (nach dem Speichern gleicht router.refresh das an)
  const settingsDirty =
    serializeSettings(settings) !==
    serializeSettings(settingsFromCourse(course));
  useUnsavedMarker(settingsDirty);

  /* Entwurf übersteht Editor-interne Navigation (Prüfungen, Gutscheine,
     Zertifikat): je Kurs in sessionStorage, stilles Wiederherstellen beim
     Zurückkommen. Sobald er dem Server-Stand entspricht (z. B. nach dem
     Speichern), verschwindet er wieder. */
  const draftKey = `course-settings-draft:${course.id}`;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      const base = settingsFromCourse(course);
      // Nur bekannte Formularfelder übernehmen – Entwürfe älterer
      // Editor-Versionen können zusätzliche Schlüssel enthalten
      const merged = Object.fromEntries(
        Object.entries(base).map(([key, value]) => [
          key,
          key in draft ? draft[key] : value,
        ])
      ) as typeof base;
      if (
        serializeSettings(merged) !==
        serializeSettings(settingsFromCourse(course))
      ) {
        // sessionStorage gibt es erst nach der Hydration – die einmalige
        // Wiederherstellung MUSS deshalb in einem Effect passieren
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings(merged);
      } else {
        sessionStorage.removeItem(draftKey);
      }
    } catch {
      sessionStorage.removeItem(draftKey);
    }
    // bewusst nur beim Mounten – danach führt der State
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Externe Synchronisation: Draft in sessionStorage spiegeln
  useEffect(() => {
    if (settingsDirty) {
      sessionStorage.setItem(draftKey, JSON.stringify(settings));
    } else {
      sessionStorage.removeItem(draftKey);
    }
  }, [settings, settingsDirty, draftKey]);

  const [coverUploading, setCoverUploading] = useState(false);
  /** Objekt-URL fürs Zuschneiden – im Handler erzeugt, beim Schließen widerrufen */
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  function onCoverFile() {
    const file = coverFileRef.current?.files?.[0];
    if (coverFileRef.current) coverFileRef.current.value = "";
    if (!file) return;
    setErrors([]);
    setErrorIndex(0);
    // Erst zuschneiden (992×558), dann hochladen
    setCropUrl(URL.createObjectURL(file));
  }

  function closeCropper() {
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropUrl(null);
  }

  async function uploadCover(blob: Blob) {
    closeCropper();
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
      formData.set("kind", "image");
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          reason?: string;
        } | null;
        setErrors([
          {
            text:
              body?.error === "content_flagged"
                ? t("uploadRejected", { reason: body.reason ?? "" })
                : t("coverUploadFailed"),
            field: { slot: "settings-cover" },
          },
        ]);
        return;
      }
      const data = (await res.json()) as { url: string };
      setSettings((s) => ({ ...s, coverImage: data.url }));
    } catch {
      setErrors([
        {
          text: t("coverUploadFailed"),
          field: { slot: "settings-cover" },
        },
      ]);
    } finally {
      setCoverUploading(false);
    }
  }
  const [newSectionTitle, setNewSectionTitle] = useState("");
  /* Mehrere Lektionen dürfen gleichzeitig offen sein – die Speicherleiste
     speichert sie gemeinsam, und kein Entwurf geht beim Öffnen einer
     weiteren Lektion verloren */
  const [addingLessonTo, setAddingLessonTo] = useState<Set<string>>(
    () => new Set()
  );
  const [editingLessons, setEditingLessons] = useState<Set<string>>(
    () => new Set()
  );
  /* Verwaltungs-Dialog der KI-Selbsttests (je Lektion) */
  const [selfTestLesson, setSelfTestLesson] = useState<{
    id: string;
    title: string;
  } | null>(null);

  function setInSet(prev: Set<string>, id: string, on: boolean): Set<string> {
    const next = new Set(prev);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  }

  /* Offene Lektions-Formulare melden ihren Änderungsstand hierher; die
     fixierte Speicherleiste submittet dann alle geänderten Formulare mit */
  const [lessonDirtyMap, setLessonDirtyMap] = useState<
    Record<string, boolean>
  >({});
  const onLessonDirtyChange = useCallback((key: string, dirty: boolean) => {
    setLessonDirtyMap((prev) =>
      (prev[key] ?? false) === dirty ? prev : { ...prev, [key]: dirty }
    );
  }, []);
  const anyLessonDirty = Object.values(lessonDirtyMap).some(Boolean);

  function saveAll() {
    // Geänderte Lektions-Formulare per requestSubmit speichern – so greift
    // deren native Pflichtfeld-Validierung weiterhin
    for (const [key, dirty] of Object.entries(lessonDirtyMap)) {
      if (!dirty) continue;
      document
        .querySelector<HTMLFormElement>(
          `form[data-lesson-form="${CSS.escape(key)}"]`
        )
        ?.requestSubmit();
    }
    document
      .querySelector<HTMLFormElement>("#course-settings-form")
      ?.requestSubmit();
  }

  // Inline-Umbenennen der Abschnitte: Doppelklick oder Enter/F2 auf dem Titel
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState("");
  const sectionTitleRefs = useRef<Map<string, HTMLHeadingElement>>(new Map());

  function startRenameSection(section: { id: string; title: string }) {
    setSectionDraft(section.title);
    setEditingSection(section.id);
  }

  function finishRenameSection(
    sectionId: string,
    currentTitle: string,
    save: boolean
  ) {
    const next = sectionDraft.trim();
    if (save && next && next !== currentTitle) {
      run(() => renameSection(sectionId, next));
    }
    setEditingSection(null);
    // Fokus zurück auf den Titel, damit Tastatur-Nutzer nicht "verloren" gehen
    requestAnimationFrame(() =>
      sectionTitleRefs.current.get(sectionId)?.focus()
    );
  }

  // Live-Vorschau: folgt den Formularfeldern mit 600 ms Drosselung
  const previewSettings = useThrottledValue(settings, 600);

  // Fehlercode → lesbarer Text (angezeigt in der fixierten Speicherleiste)
  function errorMessage(code: string, reason?: string): string {
    if (code === "content_flagged")
      return t("textFlagged", { reason: reason ?? "" });
    if (code === "price_below_minimum") return t("priceBelowMinimum");
    if (code === "moderation_flagged") return t("moderationFlagged");
    if (code === "moderation_pending") return t("moderationPending");
    if (code === "course_flagged") return t("courseFlaggedByAdmin");
    if (LESSON_ERROR_KEYS.includes(code))
      return t(`lessonErrors.${code}` as never);
    return code;
  }

  function run(
    action: () => Promise<{
      ok: boolean;
      error?: string;
      reason?: string;
      errorPath?: (string | number)[];
    }>,
    successMsg?: string,
    onSuccess?: () => void,
    fieldFor?: (
      code: string,
      path?: (string | number)[]
    ) => ErrorField | undefined
  ) {
    /* Synchron leeren: Beim gemeinsamen Speichern starten mehrere runs im
       selben Klick – alle leeren zuerst, danach sammeln sich die Fehler */
    setErrors([]);
    setErrorIndex(0);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        const code = result.error ?? "generic";
        const nextError: EditorError = {
          text: errorMessage(code, result.reason),
          field: fieldFor?.(code, result.errorPath),
        };
        setErrors((prev) => [...prev, nextError]);
        return;
      }
      if (successMsg) setNotice(successMsg);
      onSuccess?.();
      router.refresh();
    });
  }

  function onSaveSettings(event: FormEvent) {
    event.preventDefault();
    // Ohne Änderungen gibt es nichts zu speichern – kein Request
    if (!settingsDirty) return;
    run(
      () =>
        updateCourse(course.id, {
          ...settings,
          priceCents: Math.round(Number(settings.priceCents)),
          requiredWatchPercent: Number(settings.requiredWatchPercent),
        }),
      t("courseSaved"),
      () => setJustSaved(true),
      (code, path) => {
        if (code === "price_below_minimum" || path?.[0] === "priceCents")
          return { slot: "settings-price" };
        if (path?.[0] === "title") return { slot: "settings-title" };
        if (path?.[0] === "subtitle") return { slot: "settings-subtitle" };
        if (path?.[0] === "description")
          return { slot: "settings-description" };
        return { slot: "settings-form" };
      }
    );
  }

  return (
    <Wrap id="main">
      <Container>
        <HeadRow>
          <div>
            <Kicker>{t("editCourse")}</Kicker>
            <SectionTitle as="h1">{course.title}</SectionTitle>
          </div>
          <Actions>
            <Badge $tone={course.published ? "success" : "muted"}>
              {course.published ? t("published") : t("draft")}
            </Badge>
            <GhostButton
              disabled={pending}
              onClick={() =>
                run(() => setCoursePublished(course.id, !course.published))
              }
            >
              {course.published ? t("unpublish") : t("publish")}
            </GhostButton>
            {course.enrollmentCount === 0 ? (
              <DangerButton
                disabled={pending}
                onClick={() => {
                  if (window.confirm(t("deleteConfirm"))) {
                    startTransition(async () => {
                      await deleteCourse(course.id);
                      router.push("/creator");
                    });
                  }
                }}
              >
                {tc("delete")}
              </DangerButton>
            ) : null}
          </Actions>
        </HeadRow>

        {course.enrollmentCount > 0 ? (
          <Muted style={{ fontSize: "0.82rem", marginBottom: "1rem" }}>
            {t("deleteBlocked", { count: course.enrollmentCount })}
          </Muted>
        ) : null}

        <Grid>
          <Card as="section" aria-labelledby="settings-title">
            <h2
              id="settings-title"
              style={{ fontSize: "1.2rem", marginBottom: "1rem" }}
            >
              {t("editCourse")}
            </h2>
            <SettingsForm
              id="course-settings-form"
              data-error-field="settings-form"
              onSubmit={onSaveSettings}
            >
              <div data-error-field="settings-cover">
                <LabelText>{t("coverImage")}</LabelText>
                <CoverFrame $empty={!settings.coverImage}>
                  {settings.coverImage ? (
                    <Image
                      src={settings.coverImage}
                      alt={t("coverImage")}
                      fill
                      sizes="(min-width: 1024px) 380px, 100vw"
                    />
                  ) : null}
                  <CoverOverlay $empty={!settings.coverImage}>
                    <CoverActions>
                      <GhostButton
                        type="button"
                        disabled={coverUploading}
                        onClick={() => coverFileRef.current?.click()}
                      >
                        {coverUploading
                          ? tc("loading")
                          : settings.coverImage
                            ? t("replaceCover")
                            : t("uploadCover")}
                      </GhostButton>
                      {settings.coverImage ? (
                        <GhostButton
                          type="button"
                          onClick={() =>
                            setSettings((s) => ({ ...s, coverImage: "" }))
                          }
                        >
                          {t("removeCover")}
                        </GhostButton>
                      ) : null}
                    </CoverActions>
                    <p>{t("coverHint")}</p>
                  </CoverOverlay>
                </CoverFrame>
                <input
                  ref={coverFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={onCoverFile}
                />
              </div>
              {aiError ? (
                <FormAlert $tone="error" role="alert">
                  {aiError}
                </FormAlert>
              ) : null}
              <div data-error-field="settings-title">
                <Field
                  label={t("courseTitle")}
                  value={settings.title}
                  onChange={(e) =>
                    setSettings({ ...settings, title: e.target.value })
                  }
                  required
                  minLength={3}
                  trailing={
                    <AiButton
                      type="button"
                      disabled={aiField !== null}
                      aria-busy={aiField === "title"}
                      aria-label={t("copilotSuggestFor", {
                        field: t("courseTitle"),
                      })}
                      title={t("copilotSuggestFor", {
                        field: t("courseTitle"),
                      })}
                      onClick={() => suggestField("title")}
                    >
                      {aiField === "title" ? "…" : "✦"}
                    </AiButton>
                  }
                />
              </div>
              <div data-error-field="settings-subtitle">
                <Field
                  label={t("courseSubtitle")}
                  value={settings.subtitle}
                  onChange={(e) =>
                    setSettings({ ...settings, subtitle: e.target.value })
                  }
                  trailing={
                    <AiButton
                      type="button"
                      disabled={aiField !== null}
                      aria-busy={aiField === "subtitle"}
                      aria-label={t("copilotSuggestFor", {
                        field: t("courseSubtitle"),
                      })}
                      title={t("copilotSuggestFor", {
                        field: t("courseSubtitle"),
                      })}
                      onClick={() => suggestField("subtitle")}
                    >
                      {aiField === "subtitle" ? "…" : "✦"}
                    </AiButton>
                  }
                />
              </div>
              <div data-error-field="settings-description">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  <LabelText id="course-desc-label" style={{ margin: 0 }}>
                    {t("courseDescription")}
                  </LabelText>
                  <AiButton
                    type="button"
                    disabled={aiField !== null}
                    aria-busy={aiField === "description"}
                    aria-label={t("copilotSuggestFor", {
                      field: t("courseDescription"),
                    })}
                    title={t("copilotSuggestFor", {
                      field: t("courseDescription"),
                    })}
                    onClick={() => suggestField("description")}
                  >
                    {aiField === "description" ? "…" : "✦"}
                  </AiButton>
                </div>
                <RichTextEditor
                  label={t("courseDescription")}
                  value={settings.description}
                  onChange={(html) =>
                    setSettings((s) => ({ ...s, description: html }))
                  }
                  onAiImprove={improveDescriptionSelection}
                />
              </div>
              <div>
                <LabelText as="label" htmlFor="course-lang">
                  {t("courseLanguage")}
                </LabelText>
                <Select
                  id="course-lang"
                  value={settings.language}
                  options={[
                    { value: "de", label: "Deutsch" },
                    { value: "en", label: "English" },
                  ]}
                  onChange={(language) =>
                    setSettings({
                      ...settings,
                      language: language as "de" | "en",
                      // neue Basissprache kann keine Zusatzsprache mehr sein
                      extraLanguages: settings.extraLanguages.filter(
                        (l) => l !== language
                      ),
                    })
                  }
                />
              </div>
              <div>
                <LabelText>{t("courseLanguages")}</LabelText>
                <LangChipRow role="group" aria-label={t("courseLanguages")}>
                  {COURSE_LANGUAGES.map((lang) => {
                    const isBase = settings.language === lang;
                    const active =
                      isBase || settings.extraLanguages.includes(lang);
                    return (
                      <LangChip
                        key={lang}
                        type="button"
                        $active={active}
                        aria-pressed={active}
                        disabled={isBase}
                        onClick={() => toggleExtraLanguage(lang)}
                      >
                        {langName(lang)}
                        {isBase ? ` · ${t("baseLanguage")}` : ""}
                      </LangChip>
                    );
                  })}
                </LangChipRow>
                <Muted style={{ fontSize: "0.78rem", marginTop: "0.4rem" }}>
                  {t("courseLanguagesHint")}
                </Muted>
              </div>
              {activeTransLang ? (
                <TransBox>
                  <LabelText>{t("courseTranslations")}</LabelText>
                  {settings.extraLanguages.length > 1 ? (
                    <TransTabs
                      role="tablist"
                      aria-label={t("courseTranslations")}
                    >
                      {settings.extraLanguages.map((lang) => (
                        <TransTab
                          key={lang}
                          type="button"
                          role="tab"
                          aria-selected={activeTransLang === lang}
                          $active={activeTransLang === lang}
                          onClick={() => setTransLang(lang)}
                        >
                          {langName(lang)}
                        </TransTab>
                      ))}
                    </TransTabs>
                  ) : null}
                  <Field
                    label={`${t("courseTitle")} · ${langName(activeTransLang)}`}
                    placeholder={settings.title}
                    value={settings.translations[activeTransLang]?.title ?? ""}
                    onChange={(e) =>
                      patchTranslation(activeTransLang, {
                        title: e.target.value,
                      })
                    }
                  />
                  <Field
                    label={`${t("courseSubtitle")} · ${langName(activeTransLang)}`}
                    placeholder={settings.subtitle}
                    value={
                      settings.translations[activeTransLang]?.subtitle ?? ""
                    }
                    onChange={(e) =>
                      patchTranslation(activeTransLang, {
                        subtitle: e.target.value,
                      })
                    }
                  />
                  <div>
                    <LabelText>
                      {t("courseDescription")} · {langName(activeTransLang)}
                    </LabelText>
                    <RichTextEditor
                      key={activeTransLang}
                      label={`${t("courseDescription")} · ${langName(activeTransLang)}`}
                      value={
                        settings.translations[activeTransLang]?.description ??
                        ""
                      }
                      onChange={(html) =>
                        patchTranslation(activeTransLang, {
                          description: html,
                        })
                      }
                    />
                  </div>
                  <Muted style={{ fontSize: "0.78rem" }}>
                    {t("translationFallbackNote", {
                      base: langName(settings.language),
                    })}
                  </Muted>
                </TransBox>
              ) : null}
              <div>
                <LabelText as="label" htmlFor="course-category">
                  {t("courseCategory")}
                </LabelText>
                <Select
                  id="course-category"
                  value={settings.category}
                  options={[
                    { value: "", label: t("noCategory") },
                    ...COURSE_CATEGORIES.map((c) => ({
                      value: c.id,
                      label: locale === "en" ? c.en : c.de,
                    })),
                  ]}
                  onChange={(category) =>
                    setSettings({ ...settings, category })
                  }
                />
              </div>
              <TagInput
                label={t("courseTags")}
                value={settings.tags}
                onChange={(tags) => setSettings({ ...settings, tags })}
                placeholder={t("tagsPlaceholder")}
                hint={t("tagsHint")}
                labelAction={
                  <AiButton
                    type="button"
                    disabled={aiField !== null}
                    aria-busy={aiField === "tags"}
                    aria-label={t("copilotSuggestFor", {
                      field: t("courseTags"),
                    })}
                    title={t("copilotSuggestFor", { field: t("courseTags") })}
                    onClick={() => suggestField("tags")}
                  >
                    {aiField === "tags" ? "…" : "✦"}
                  </AiButton>
                }
              />
              <div>
                <LabelText id="price-mode-label">{t("coursePrice")}</LabelText>
                <PriceSegment role="group" aria-labelledby="price-mode-label">
                  <PriceSegButton
                    type="button"
                    $active={settings.priceCents === 0}
                    aria-pressed={settings.priceCents === 0}
                    onClick={() => {
                      // Kostenlos ⇒ Shop-Listung ist Pflicht; erklären, falls sie aus war
                      if (!settings.listedInShop) setShopLockHint(true);
                      setSettings({
                        ...settings,
                        priceCents: 0,
                        listedInShop: true,
                      });
                    }}
                  >
                    {t("priceFree")}
                  </PriceSegButton>
                  <PriceSegButton
                    type="button"
                    $active={settings.priceCents > 0}
                    aria-pressed={settings.priceCents > 0}
                    onClick={() => {
                      if (settings.priceCents !== 0) return;
                      setShopLockHint(false);
                      // Startvorschlag 29,99 € – Mindestpreis bleibt 4,99 €
                      setSettings({ ...settings, priceCents: 2999 });
                    }}
                  >
                    {t("pricePaid")}
                  </PriceSegButton>
                </PriceSegment>
              </div>
              {settings.priceCents > 0 ? (
                <div data-error-field="settings-price">
                <Field
                  label={t("priceAmount")}
                  hint={t("priceMinHint")}
                  type="number"
                  min={MIN_PRICE_CENTS / 100}
                  step={0.01}
                  value={settings.priceCents / 100}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      priceCents: Math.round(Number(e.target.value) * 100),
                    })
                  }
                  onBlur={() => {
                    // Mindestpreis 4,99 € – beim Verlassen sanft anheben
                    if (
                      settings.priceCents > 0 &&
                      settings.priceCents < MIN_PRICE_CENTS
                    ) {
                      setSettings((s) => ({
                        ...s,
                        priceCents: MIN_PRICE_CENTS,
                      }));
                    }
                  }}
                />
                </div>
              ) : null}
              {settings.priceCents > 0 ? (
                <ShareHint aria-label={t("priceShareLabel")}>
                  <dt>
                    {t("priceSharePlatform", {
                      percent: CREATOR_SHARE_PERCENT.PLATFORM,
                    })}
                  </dt>
                  <dd>
                    {formatPrice(
                      creatorShareCents(settings.priceCents, "PLATFORM"),
                      "EUR",
                      locale
                    )}
                  </dd>
                  <dt>
                    {t("priceShareExternal", {
                      percent: CREATOR_SHARE_PERCENT.EXTERNAL,
                    })}
                  </dt>
                  <dd>
                    {formatPrice(
                      creatorShareCents(settings.priceCents, "EXTERNAL"),
                      "EUR",
                      locale
                    )}
                  </dd>
                </ShareHint>
              ) : null}
              <Field
                label={t("requiredWatchPercent")}
                type="number"
                min={0}
                max={100}
                value={settings.requiredWatchPercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    requiredWatchPercent: Number(e.target.value),
                  })
                }
              />
              <CheckboxRow>
                <input
                  type="checkbox"
                  checked={settings.finalExamRequired}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      finalExamRequired: e.target.checked,
                    })
                  }
                />
                {t("finalExamRequired")}
              </CheckboxRow>
              <CheckboxRow>
                <input
                  type="checkbox"
                  checked={settings.selfTestsEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      selfTestsEnabled: e.target.checked,
                    })
                  }
                />
                {t("selfTestsEnabled")}
              </CheckboxRow>
              <CheckboxRow>
                <input
                  type="checkbox"
                  checked={settings.listedInShop}
                  aria-describedby={
                    shopLockHint ? "listed-in-shop-hint" : undefined
                  }
                  onChange={(e) => {
                    if (!e.target.checked && settings.priceCents === 0) {
                      // neues Objekt erzwingt den Re-Render, der die Checkbox angehakt lässt
                      setShopLockHint(true);
                      setSettings({ ...settings, listedInShop: true });
                      return;
                    }
                    setShopLockHint(false);
                    setSettings({
                      ...settings,
                      listedInShop: e.target.checked,
                    });
                  }}
                />
                {t("listedInShop")}
              </CheckboxRow>
              {shopLockHint ? (
                <CheckboxHint id="listed-in-shop-hint" role="status">
                  {t("listedInShopFreeHint")}
                </CheckboxHint>
              ) : null}

              {!course.published ? (
                <>
                  <CheckboxRow>
                    <input
                      type="checkbox"
                      checked={settings.waitlistEnabled}
                      aria-describedby="waitlist-hint"
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          waitlistEnabled: e.target.checked,
                        })
                      }
                    />
                    {t("waitlistEnabled")}
                  </CheckboxRow>
                  <CheckboxHint id="waitlist-hint">
                    {t("waitlistHint")}
                  </CheckboxHint>
                </>
              ) : null}

              <CheckboxRow>
                <input
                  type="checkbox"
                  checked={settings.bookingEnabled}
                  aria-describedby={
                    settings.bookingEnabled && !course.bookingConnected
                      ? "booking-connect-hint"
                      : undefined
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      bookingEnabled: e.target.checked,
                    })
                  }
                />
                {t("bookingOffer")}
              </CheckboxRow>
              {settings.bookingEnabled && !course.bookingConnected ? (
                /* Ohne Konto-Verbindung wird nichts angeboten – der Link
                   startet den Connect-Flow in den Einstellungen */
                <CheckboxHint id="booking-connect-hint" role="status">
                  {t("bookingNotConnected")}{" "}
                  <Link href="/settings" data-allow-unsaved="">
                    {t("bookingConnectInSettings")}
                  </Link>
                </CheckboxHint>
              ) : null}

              <QuizLink
                href={{
                  pathname: "/creator/courses/[id]/quiz/[target]",
                  params: { id: course.id, target: "final" },
                }}
              >
                ✦ {t("finalExam")}:{" "}
                {course.finalQuiz ? course.finalQuiz.title : t("addQuiz")}
              </QuizLink>
              <QuizLink
                href={{
                  pathname: "/creator/courses/[id]/coupons",
                  params: { id: course.id },
                }}
              >
                ✦ {t("manageCoupons")}
              </QuizLink>
              <QuizLink
                href={{
                  pathname: "/creator/courses/[id]/stats",
                  params: { id: course.id },
                }}
              >
                ✦ {t("courseStats")}
              </QuizLink>
              <QuizLink
                href={{
                  pathname: "/creator/courses/[id]/certificate",
                  params: { id: course.id },
                }}
              >
                ✦ {t("designCertificate")}
              </QuizLink>
            </SettingsForm>
          </Card>

          {/* Wissensstand des Lernassistenten: Videos ohne Transkript
              sind fuer ihn stumm - das muss der Creator sehen. */}
          <AssistantCoverage sections={course.sections} />

          <section aria-labelledby="sections-title">
            <h2
              id="sections-title"
              style={{ fontSize: "1.2rem", marginBottom: "1rem" }}
            >
              {t("sections")}
            </h2>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {course.sections.map((section, si) => (
                <SectionCard
                  key={section.id}
                  as="article"
                  $dragging={drag?.kind === "section" && drag.id === section.id}
                  $dropActive={dropKey === `section:${section.id}`}
                  onDragOver={(e: DragEvent) => onDragOverSection(e, section.id)}
                  onDragLeave={() => clearDropKey(`section:${section.id}`)}
                  onDrop={(e: DragEvent) => onDropSection(e, section.id)}
                >
                  <SectionHead>
                    <DragHandle
                      draggable
                      aria-hidden
                      title={t("dragHint")}
                      onDragStart={(e) =>
                        startDrag(e, { kind: "section", id: section.id })
                      }
                      onDragEnd={endDrag}
                    >
                      ⠿
                    </DragHandle>
                    {editingSection === section.id ? (
                      <TitleInput
                        autoFocus
                        value={sectionDraft}
                        aria-label={t("sectionTitle")}
                        onChange={(e) => setSectionDraft(e.target.value)}
                        onBlur={() =>
                          finishRenameSection(section.id, section.title, true)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            finishRenameSection(
                              section.id,
                              section.title,
                              true
                            );
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            finishRenameSection(
                              section.id,
                              section.title,
                              false
                            );
                          }
                        }}
                      />
                    ) : (
                      <EditableTitle
                        ref={(el: HTMLHeadingElement | null) => {
                          if (el) sectionTitleRefs.current.set(section.id, el);
                          else sectionTitleRefs.current.delete(section.id);
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`${tc("edit")}: ${section.title}`}
                        title={t("renameSectionHint")}
                        onDoubleClick={() => startRenameSection(section)}
                        onKeyDown={(e) => {
                          if (["Enter", " ", "F2"].includes(e.key)) {
                            e.preventDefault();
                            startRenameSection(section);
                          }
                        }}
                      >
                        {section.title}
                      </EditableTitle>
                    )}
                    <IconButton
                      aria-label={t("moveUp")}
                      disabled={si === 0 || pending}
                      onClick={() => run(() => moveSection(section.id, "up"))}
                    >
                      ↑
                    </IconButton>
                    <IconButton
                      aria-label={t("moveDown")}
                      disabled={si === course.sections.length - 1 || pending}
                      onClick={() => run(() => moveSection(section.id, "down"))}
                    >
                      ↓
                    </IconButton>
                    <IconButton
                      aria-label={`${tc("delete")}: ${section.title}`}
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(t("deleteConfirm"))) {
                          run(() => deleteSection(section.id));
                        }
                      }}
                    >
                      ✕
                    </IconButton>
                  </SectionHead>

                  <QuizLink
                    href={{
                      pathname: "/creator/courses/[id]/quiz/[target]",
                      params: { id: course.id, target: section.id },
                    }}
                  >
                    ✦ {t("sectionQuiz")}:{" "}
                    {section.quiz ? section.quiz.title : t("addQuiz")}
                  </QuizLink>

                  <SectionDripSettings
                    section={section}
                    isFirst={si === 0}
                    pending={pending}
                    onSave={(drip) =>
                      run(
                        () => updateSectionDrip(section.id, drip),
                        t("dripSaved")
                      )
                    }
                  />

                  {settings.extraLanguages.length > 0 ? (
                    <SectionTranslations
                      key={`${section.id}-${settings.extraLanguages.join(",")}`}
                      section={section}
                      extraLanguages={settings.extraLanguages}
                      pending={pending}
                      onSave={(drafts) =>
                        run(
                          () => updateSectionTranslations(section.id, drafts),
                          t("translationsSaved")
                        )
                      }
                    />
                  ) : null}

                  {section.lessons.map((lesson, li) =>
                    editingLessons.has(lesson.id) ? (
                      <LessonBlocksForm
                        key={lesson.id}
                        languages={courseLangs}
                        initial={{
                          title: lesson.title,
                          isPreview: lesson.isPreview,
                          blocks: lesson.blocks,
                          translations: lesson.translations,
                        }}
                        pending={pending}
                        dirtyKey={lesson.id}
                        onDirtyChange={onLessonDirtyChange}
                        onCancel={() =>
                          setEditingLessons((prev) =>
                            setInSet(prev, lesson.id, false)
                          )
                        }
                        onSubmit={(draft) => {
                          // Erst nach Server-Erfolg schließen – bei einem
                          // Fehler bleibt der Entwurf sonst nicht erhalten
                          run(
                            () => updateLesson(lesson.id, draftToInput(draft)),
                            undefined,
                            () => {
                              setEditingLessons((prev) =>
                                setInSet(prev, lesson.id, false)
                              );
                              setJustSaved(true);
                            },
                            (code, path) =>
                              lessonErrorField(lesson.id, path)
                          );
                        }}
                      />
                    ) : (
                      <LessonRow
                        key={lesson.id}
                        $dragging={
                          drag?.kind === "lesson" && drag.id === lesson.id
                        }
                        $dropActive={dropKey === `lesson:${lesson.id}`}
                        onDragOver={(e: DragEvent) =>
                          onDragOverLesson(e, lesson.id)
                        }
                        onDragLeave={() => clearDropKey(`lesson:${lesson.id}`)}
                        onDrop={(e: DragEvent) =>
                          onDropLesson(e, section.id, lesson.id)
                        }
                      >
                        <DragHandle
                          draggable
                          aria-hidden
                          title={t("dragHint")}
                          onDragStart={(e) =>
                            startDrag(e, {
                              kind: "lesson",
                              id: lesson.id,
                              fromSection: section.id,
                            })
                          }
                          onDragEnd={endDrag}
                        >
                          ⠿
                        </DragHandle>
                        <Badge $tone="violet">
                          {t("blockCount", { count: lesson.blocks.length })}
                        </Badge>
                        {lesson.isPreview ? (
                          <Badge $tone="accent">{t("previewBadge")}</Badge>
                        ) : null}
                        <strong>{lesson.title}</strong>
                        <IconButton
                          aria-label={t("moveUp")}
                          disabled={li === 0 || pending}
                          onClick={() => run(() => moveLesson(lesson.id, "up"))}
                        >
                          ↑
                        </IconButton>
                        <IconButton
                          aria-label={t("moveDown")}
                          disabled={
                            li === section.lessons.length - 1 || pending
                          }
                          onClick={() =>
                            run(() => moveLesson(lesson.id, "down"))
                          }
                        >
                          ↓
                        </IconButton>
                        <IconButton
                          aria-label={`${t("selfTestManage")}: ${lesson.title}`}
                          disabled={pending}
                          onClick={() => setSelfTestLesson(lesson)}
                        >
                          🧠
                        </IconButton>
                        <IconButton
                          aria-label={`${tc("edit")}: ${lesson.title}`}
                          disabled={pending}
                          onClick={() =>
                            setEditingLessons((prev) =>
                              setInSet(prev, lesson.id, true)
                            )
                          }
                        >
                          ✎
                        </IconButton>
                        <IconButton
                          aria-label={`${tc("delete")}: ${lesson.title}`}
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(t("deleteConfirm"))) {
                              run(() => deleteLesson(lesson.id));
                            }
                          }}
                        >
                          ✕
                        </IconButton>
                      </LessonRow>
                    )
                  )}

                  {addingLessonTo.has(section.id) ? (
                    <LessonBlocksForm
                      initial={EMPTY_LESSON}
                      languages={courseLangs}
                      pending={pending}
                      dirtyKey={`new:${section.id}`}
                      onDirtyChange={onLessonDirtyChange}
                      onCancel={() =>
                        setAddingLessonTo((prev) =>
                          setInSet(prev, section.id, false)
                        )
                      }
                      onSubmit={(draft) => {
                        run(
                          () => addLesson(section.id, draftToInput(draft)),
                          undefined,
                          () => {
                            setAddingLessonTo((prev) =>
                              setInSet(prev, section.id, false)
                            );
                            setJustSaved(true);
                          },
                          (code, path) =>
                            lessonErrorField(`new:${section.id}`, path)
                        );
                      }}
                    />
                  ) : (
                    <GhostButton
                      type="button"
                      onClick={() =>
                        setAddingLessonTo((prev) =>
                          setInSet(prev, section.id, true)
                        )
                      }
                      style={{ alignSelf: "flex-start" }}
                    >
                      + {t("newLesson")}
                    </GhostButton>
                  )}
                </SectionCard>
              ))}

              <InlineForm
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (newSectionTitle.trim()) {
                    setNewSectionTitle("");
                    run(() => addSection(course.id, newSectionTitle));
                  }
                }}
                onDragOver={onDragOverSectionEnd}
                onDragLeave={() => clearDropKey("section-end")}
                onDrop={onDropSectionEnd}
                style={
                  dropKey === "section-end"
                    ? { outline: "2px dashed currentColor", outlineOffset: 4 }
                    : undefined
                }
              >
                <RowSplit>
                  <Field
                    label={t("sectionTitle")}
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    required
                  />
                  <PrimaryButton
                    type="submit"
                    disabled={pending}
                    style={{ alignSelf: "end" }}
                  >
                    + {t("newSection")}
                  </PrimaryButton>
                </RowSplit>
              </InlineForm>
            </div>
          </section>
        </Grid>

        <section
          aria-labelledby="live-preview-title"
          style={{ marginTop: "3rem" }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <Kicker id="live-preview-title">{t("livePreview")}</Kicker>
            <ViewLiveLink
              href={{
                pathname: "/courses/[slug]",
                params: { slug: course.slug },
              }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("viewLivePage")} ↗
            </ViewLiveLink>
          </div>
          <Muted style={{ margin: "0.4rem 0 1rem", fontSize: "0.9rem" }}>
            {t("livePreviewHint")}
          </Muted>
          <CoursePreview
            settings={{
              title: previewSettings.title,
              subtitle: previewSettings.subtitle,
              description: previewSettings.description,
              coverImage: previewSettings.coverImage,
              priceCents: previewSettings.priceCents,
              requiredWatchPercent: previewSettings.requiredWatchPercent,
              language: previewSettings.language,
              extraLanguages: previewSettings.extraLanguages,
            }}
            creatorName={creatorName}
            sections={course.sections.map((s) => ({
              id: s.id,
              title: s.title,
              hasQuiz: Boolean(s.quiz),
              lessons: s.lessons.map((l) => ({
                id: l.id,
                title: l.title,
                durationSeconds: l.durationSeconds,
                isPreview: l.isPreview,
              })),
            }))}
          />
        </section>

        {cropUrl ? (
          <ImageCropper
            imageUrl={cropUrl}
            onCancel={closeCropper}
            onCropped={uploadCover}
          />
        ) : null}
      </Container>

      {selfTestLesson ? (
        <SelfTestManager
          key={selfTestLesson.id}
          lessonId={selfTestLesson.id}
          lessonTitle={selfTestLesson.title}
          languages={courseLangs}
          open
          onClose={() => setSelfTestLesson(null)}
        />
      ) : null}

      <SaveBar>
        <SaveBarInner>
          {activeError ? (
            <BarMessage $tone="error" role="alert">
              {errors.length > 1 ? (
                <ErrorNav
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                      e.preventDefault();
                      stepError(-1);
                    } else if (
                      e.key === "ArrowRight" ||
                      e.key === "ArrowDown"
                    ) {
                      e.preventDefault();
                      stepError(1);
                    }
                  }}
                >
                  <ErrorNavButton
                    type="button"
                    aria-label={t("prevError")}
                    onClick={() => stepError(-1)}
                  >
                    ‹
                  </ErrorNavButton>
                  <ErrorCount>
                    {shownErrorIndex + 1}/{errors.length}
                  </ErrorCount>
                  <ErrorNavButton
                    type="button"
                    aria-label={t("nextError")}
                    onClick={() => stepError(1)}
                  >
                    ›
                  </ErrorNavButton>
                </ErrorNav>
              ) : null}
              <span>{activeError.text}</span>
            </BarMessage>
          ) : notice ? (
            <BarMessage $tone="success" role="status">
              {notice}
            </BarMessage>
          ) : null}
          {settingsDirty || anyLessonDirty ? (
            <span>{t("unsavedChanges")}</span>
          ) : null}
          <SaveButton
            type="button"
            onClick={saveAll}
            disabled={pending || (!settingsDirty && !anyLessonDirty)}
            $saved={justSaved && !settingsDirty && !anyLessonDirty}
          >
            {justSaved && !settingsDirty && !anyLessonDirty
              ? `✓ ${t("allSaved")}`
              : tc("save")}
          </SaveButton>
        </SaveBarInner>
      </SaveBar>
    </Wrap>
  );
}
