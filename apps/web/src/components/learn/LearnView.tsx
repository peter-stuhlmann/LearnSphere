"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import { flushSync } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";
import { Link, useRouter } from "@/i18n/navigation";
import { courseWatchPercent } from "@elearning/core/progress";
import {
  markLessonVisited,
  resetLessonProgress,
  toggleLessonFavorite,
  updateLessonProgress,
} from "@/app/actions/learning-actions";
import { recordWatchBuckets } from "@/app/actions/heatmap-actions";
import { bucketIndexFor } from "@elearning/core/heatmap";
import { formatDuration } from "@elearning/core/format";
import {
  pickCourseLanguage,
  resolveBlock,
  translatedText,
} from "@elearning/core/course-i18n";
import { withViewTransition } from "@/components/navigation/view-transition";
import { BlockRenderer, type RenderableBlock } from "./BlockRenderer";
import { ReadAloud } from "./ReadAloud";
import { AssistantDock } from "./AssistantDock";
import { LessonCommunity, type CommunityViewer } from "./LessonCommunity";
import { RatingWidget } from "./RatingWidget";
import { SelfTest } from "./SelfTest";
import { LessonNotes } from "./LessonNotes";
import { BookingCard } from "./BookingCard";
import {
  Badge,
  Container,
  GhostButton,
  Kicker,
  PrimaryButton,
  ToolbarButton,
} from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { UpNextCountdown } from "./UpNextCountdown";

const Wrap = styled.main`
  padding: 2.5rem 0 2rem;
`;

/* Vorschau-Hinweis für den Creator: „so sehen es Teilnehmer" */
const PreviewBanner = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.violet};
  background: ${({ theme }) => theme.colors.violetSoft};
  font-size: 0.88rem;

  strong {
    color: ${({ theme }) => theme.colors.violet};
  }

  span.hint {
    color: ${({ theme }) => theme.colors.textMuted};
  }

  a {
    margin-left: auto;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.violet};
    text-underline-offset: 3px;
  }
`;

const TopBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;

  h1 {
    font-size: clamp(1.4rem, 4vw, 2rem);
  }
`;

const ProgressWrap = styled.div`
  flex: 1;
  min-width: 200px;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  span {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.78rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const Layout = styled.div`
  display: grid;
  gap: 1.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 320px 1fr;
    align-items: start;
  }
`;

/* Linke Spalte: Inhaltsverzeichnis + Kurssprache; klebt als Ganzes */
const SidebarColumn = styled.div`
  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    position: sticky;
    top: 90px;
    max-height: calc(100dvh - 120px);
    display: flex;
    flex-direction: column;
  }
`;

const Sidebar = styled.nav`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  overflow: hidden;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
`;

const SectionTitleRow = styled.p`
  padding: 0.9rem 1.1rem 0.5rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const LessonButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  text-align: left;
  padding: 0.7rem 1.1rem;
  font-size: 0.9rem;
  color: ${({ theme, $active }) =>
    $active ? theme.colors.text : theme.colors.textMuted};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accentSoft : "transparent"};
  border-left: 3px solid
    ${({ theme, $active }) => ($active ? theme.colors.accent : "transparent")};

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

/* Micro-Interaction: der Haken "ploppt", wenn eine Lektion erledigt wird */
const checkPop = keyframes`
  0% {
    transform: scale(0.4);
  }
  60% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
`;

const Check = styled.span<{ $done: boolean }>`
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid
    ${({ theme, $done }) =>
      $done ? theme.colors.success : theme.colors.borderStrong};
  color: ${({ theme }) => theme.colors.success};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;

  ${({ $done }) =>
    $done &&
    css`
      animation: ${checkPop} 300ms ease;
    `}
`;

const quizRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.6rem;
  padding: 0.7rem 1.1rem;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.violet};
  text-decoration: none;

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const QuizRow = styled(Link)`
  ${quizRowCss}
`;
/* Vorschau: statische, nicht anklickbare Variante */
const QuizRowStatic = styled.div`
  ${quizRowCss}
`;

/* Drip Content: Hinweiszeile unter dem Titel eines gesperrten Abschnitts */
const LockHint = styled.p`
  padding: 0 1.1rem 0.6rem;
  font-size: 0.78rem;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const LockedLessonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 1.1rem;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.textFaint};
  opacity: 0.75;
`;

const Stage = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  /* Mobil kompakter: verschachtelte Karten (z. B. Notizen) würden sonst durch
     Container + Stage + Card-Padding zu viel Breite fressen → starkes Wrapping */
  padding: clamp(0.9rem, 3.2vw, 1.5rem);
  background: ${({ theme }) => theme.colors.surface};

  h2 {
    font-size: 1.4rem;
  }
`;

/* Kopfzeile der Lektion: Titel links, Werkzeuge (Fokus, Vorlesen) rechts.
   Der Abstand zum Inhalt liegt hier – ein margin am h2 käme im Flex-Layout
   nie unterhalb der Zeile an. */
const LessonHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
`;

const LessonTools = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

/* Stern neben favorisierten Lektionen in der Sidebar */
const FavoriteStar = styled.span`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.accent};
  flex-shrink: 0;
`;

/**
 * Fokus-Modus: Die Inhalts-Spalte legt sich als Vollbild-Ebene über die
 * Seite (gleiche DOM-Knoten – laufende Videos werden nicht neu gemountet),
 * mit Ambient-Glow hinter dem Inhalt. Esc oder ✕ beendet.
 */
const ContentColumn = styled.div<{ $focus: boolean; $vt: boolean }>`
  /* Fokus-Toggle als View Transition: über diesen Namen morpht die Spalte
     (samt laufendem Video) von der alten zur neuen Lage statt umzuspringen.
     Nur während des Toggles gesetzt, damit normale Seitenwechsel die Spalte
     nicht aus der Seiten-Animation ausklammern. */
  ${({ $vt }) =>
    $vt &&
    css`
      view-transition-name: learn-content;
    `}

  ${({ $focus, theme }) =>
    $focus &&
    css`
      position: fixed;
      inset: 0;
      z-index: 80;
      overflow-y: auto;
      padding: 3.5rem clamp(1rem, 4vw, 3rem) 3rem;
      background:
        radial-gradient(
          ellipse 70% 45% at 50% 0%,
          rgba(200, 255, 77, 0.07),
          transparent 70%
        ),
        radial-gradient(
          ellipse 60% 40% at 50% 100%,
          rgba(167, 139, 250, 0.07),
          transparent 70%
        ),
        ${theme.colors.bg};

      > * {
        max-width: 980px;
        margin-left: auto;
        margin-right: auto;
      }
    `}
`;

/* Gleiche Optik wie die Werkzeugleiste, nur schwebend über dem Vollbild */
const FocusExit = styled(ToolbarButton)`
  position: fixed;
  top: 0.9rem;
  right: 1rem;
  z-index: 90;
  background: ${({ theme }) => theme.colors.surface};
`;

/* Menüpunkt „Abschlussprüfung & Zertifikat" ganz unten in der Kurs-Sidebar */
const examRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.6rem;
  padding: 0.85rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accent};
  text-decoration: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: -2px;
  }
`;

const ExamNavRow = styled(Link)`
  ${examRowCss}
`;
/* Vorschau: statische, nicht anklickbare Variante */
const ExamNavRowStatic = styled.div`
  ${examRowCss}
`;

/* Lektionsende: prominente „Weiter"-Leiste – hält den Lern-Flow ohne
   Sidebar-Klick am Laufen (auch im Fokus-Modus). */
const NextBar = styled.div`
  margin-top: 1.75rem;
  padding-top: 1.5rem;
  border-top: 1px dashed ${({ theme }) => theme.colors.border};
  display: flex;
  justify-content: flex-end;
`;

const NextPrimary = styled(PrimaryButton)`
  gap: 0.5rem;
  max-width: 100%;

  /* langer Lektionstitel darf umbrechen statt die Leiste zu sprengen */
  white-space: normal;
  text-align: left;
`;

const DoneNote = styled.p`
  font-size: 1rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accent};
`;

/* Kursende: die Abschlussprüfung als „Ziellinie" – freigeschaltet oder mit
   sichtbarer Checkliste, was noch fehlt. */
const ExamGate = styled.div`
  margin-top: 1.75rem;
  padding: 1.25rem 1.35rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background:
    radial-gradient(
      ellipse 80% 100% at 100% 0%,
      rgba(200, 255, 77, 0.08),
      transparent 60%
    ),
    ${({ theme }) => theme.colors.bgElevated};
`;

const ExamHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;

  strong {
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: 1.2rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

const ExamHint = styled.p`
  margin-top: 0.9rem;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ReqList = styled.ul`
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.92rem;
  }

  li[data-done="true"] {
    color: ${({ theme }) => theme.colors.text};
  }

  li[data-done="false"] {
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

/** Ziel des „Weiter"-Buttons am Lektionsende. */
type NextTarget =
  | { kind: "none" }
  | { kind: "lesson"; id: string; title: string }
  | { kind: "quiz"; quizId: string; title: string }
  | { kind: "exam"; quizId: string }
  | { kind: "done" };

interface LearnLesson {
  id: string;
  title: string;
  translations?: unknown;
  durationSeconds: number;
  watchedSeconds: number;
  completed: boolean;
  /** vom Lernenden als Favorit markiert (Stern) */
  favorite: boolean;
  /** letzte Abspielposition je Medienblock (Fortsetzen an der Stelle) */
  positions: Record<string, number>;
  /** genug Lernstoff für "Teste dich"? (je Sprache, serverseitig geprüft) */
  selfTest: Record<string, boolean>;
  blocks: RenderableBlock[];
}

interface LearnSection {
  id: string;
  title: string;
  translations?: unknown;
  /** Drip Content: Abschnitt aktuell gesperrt (Inhalte nicht geladen) */
  locked: boolean;
  /** Zeit-Gate: wird zu diesem Zeitpunkt freigeschaltet */
  unlocksAt: string | null;
  /** Prüfungs-Gate: Zwischenprüfung des vorherigen Abschnitts nötig */
  requiresPreviousQuiz: boolean;
  quiz: { id: string; title: string; passed: boolean } | null;
  /** Stand der Zwischenprüfung – für Ringfarbe und Hinweis in der Lernreise */
  quizState: {
    passed: boolean;
    /** gesperrt bis: nächster Versuch erst ab diesem Zeitpunkt */
    nextAttemptAt: string | null;
    /** alle erlaubten Versuche verbraucht */
    exhausted: boolean;
  } | null;
  lessons: LearnLesson[];
}

interface LearnCourse {
  slug: string;
  title: string;
  /** Basissprache des Kurses */
  language: string;
  /** Alle Kurssprachen, Basissprache zuerst */
  languages: string[];
  translations?: unknown;
  requiredWatchPercent: number;
  finalExamRequired: boolean;
  /** KI-Selbsttests ("Teste dich") aktiv? */
  selfTestsEnabled: boolean;
  /** Live-Termine (termine.lol) am Kurs konfiguriert? */
  bookingEnabled: boolean;
  finalQuiz: {
    id: string;
    title: string;
    passPercent: number;
    /** darf nach Bestehen wiederholt werden? (Creator-Einstellung) */
    retakeAllowed: boolean;
    /** bisherige Versuche – für den direkten „Nochmal versuchen"-Link */
    attempts: number;
  } | null;
  sections: LearnSection[];
}

const LangSwitch = styled.div`
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.2rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
`;

/* Kurssprache: eigene kleine Karte unter dem Inhaltsverzeichnis */
const LangCard = styled.div`
  margin-top: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: 0.85rem 1.1rem;

  > span {
    font-size: 0.85rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const LangSwitchButton = styled.button<{ $active: boolean }>`
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

/**
 * Kursinhalte in die gewählte Sprache auflösen: Titel feldweise mit
 * Fallback, Blöcke inkl. Medien-Fallback-Flags fürs "Original"-Badge.
 */
function resolveCourseForLocale(
  course: LearnCourse,
  locale: string
): LearnCourse {
  if (locale === course.language) return course;
  return {
    ...course,
    title: translatedText(course.translations, locale, "title", course.title),
    sections: course.sections.map((section) => ({
      ...section,
      title: translatedText(
        section.translations,
        locale,
        "title",
        section.title
      ),
      lessons: section.lessons.map((lesson) => ({
        ...lesson,
        title: translatedText(
          lesson.translations,
          locale,
          "title",
          lesson.title
        ),
        blocks: lesson.blocks.map((block) => {
          const resolved = resolveBlock(block, locale, course.language);
          return {
            ...block,
            title: resolved.title ?? "",
            url: resolved.url ?? "",
            fileName: resolved.fileName ?? "",
            poster: resolved.poster ?? "",
            content: resolved.content ?? "",
            durationSeconds: resolved.durationSeconds,
            mediaFallback: resolved.mediaFallback,
            textFallback: resolved.textFallback,
            fallbackLanguage: course.language,
            // Herkunft folgt dem tatsächlich angezeigten Text
            provenance: resolved.provenance,
            // Kapitel gehören zum Basismedium – bei eigenem übersetzten
            // Medium würden die Zeiten nicht stimmen
            chapters: resolved.mediaFallback ? block.chapters : [],
          };
        }),
      })),
    })),
  };
}

interface LearnViewProps {
  course: LearnCourse;
  courseId: string;
  /** Creator-Vorschau: echte Lernansicht, aber ohne Fortschritt zu speichern */
  previewMode?: boolean;
  /** zuletzt geöffnete Lektion – dort geht es weiter (null = Kursanfang) */
  lastLessonId: string | null;
  watchPercent: number;
  examEligible: boolean;
  certificateSerial: string | null;
  myRating: number | null;
  myComment: string | null;
  community: CommunityViewer;
}

/* Three.js nur laden, wenn die Lernansicht wirklich gerendert wird */
/* Platzhalter mit exakt der Grundfläche der Lernreise (Höhe + margin-bottom),
   damit das clientseitig geladene 3D-Fenster beim Erscheinen nichts verschiebt.
   Spiegelt Rahmen/Radius/Hintergrund; ein dezentes Pulsieren zeigt „lädt". */
const journeyPulse = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.85; }
`;

const JourneyReserve = styled.div`
  height: 300px;
  margin-bottom: 1.5rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background:
    radial-gradient(
      ellipse 80% 130% at 85% -20%,
      rgba(139, 124, 255, 0.16),
      transparent 65%
    ),
    ${({ theme }) => theme.colors.bgDeep};
  animation: ${journeyPulse} 1.6s ease-in-out infinite;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    height: 360px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const JourneyPath3D = dynamic(
  () => import("./JourneyPath3D").then((m) => m.JourneyPath3D),
  { ssr: false, loading: () => <JourneyReserve aria-hidden /> }
);

const PROGRESS_SAVE_INTERVAL_MS = 10_000;

/** localStorage ändert sich hier nie von außen – kein Abo nötig. */
function subscribeNever() {
  return () => {};
}

/** true höchstens einmal pro Intervall – für gedrosseltes Speichern. */
function shouldSaveNow(lastSavedRef: { current: number }): boolean {
  const now = Date.now();
  if (now - lastSavedRef.current > PROGRESS_SAVE_INTERVAL_MS) {
    lastSavedRef.current = now;
    return true;
  }
  return false;
}

export function LearnView({
  course,
  courseId,
  previewMode = false,
  lastLessonId,
  watchPercent,
  examEligible,
  certificateSerial,
  myRating,
  myComment,
  community,
}: LearnViewProps) {
  const t = useTranslations("learn");
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Inhaltssprache: explizite Wahl > gemerkte Wahl (localStorage) >
  // Site-Sprache (falls der Kurs sie hat) > Basissprache. localStorage wird
  // hydration-sicher über useSyncExternalStore gelesen (Server: null).
  const storedLang = useSyncExternalStore(
    subscribeNever,
    () => window.localStorage.getItem(`course-lang:${course.slug}`),
    () => null
  );
  const [chosenLang, setChosenLang] = useState<string | null>(null);
  const contentLang =
    chosenLang ??
    (storedLang && course.languages.includes(storedLang)
      ? storedLang
      : pickCourseLanguage(course.languages, locale));

  function changeContentLang(lang: string) {
    setChosenLang(lang);
    try {
      window.localStorage.setItem(`course-lang:${course.slug}`, lang);
    } catch {
      // localStorage nicht verfügbar – Auswahl gilt nur für diese Sitzung
    }
  }

  const viewCourse = useMemo(
    () => resolveCourseForLocale(course, contentLang),
    [course, contentLang]
  );

  // Drip Content: Lektionen gesperrter Abschnitte sind nicht anwählbar
  const unlockedLessons = useMemo(
    () => viewCourse.sections.filter((s) => !s.locked).flatMap((s) => s.lessons),
    [viewCourse]
  );
  const firstIncomplete =
    unlockedLessons.find((l) => !l.completed) ?? unlockedLessons[0] ?? null;
  // Weitermachen, wo man aufgehört hat: gemerkte Position schlägt die
  // erste unerledigte Lektion – außer der Abschnitt ist (wieder) gesperrt
  const [activeId, setActiveId] = useState<string | null>(
    (lastLessonId && unlockedLessons.some((l) => l.id === lastLessonId)
      ? lastLessonId
      : null) ??
      firstIncomplete?.id ??
      null
  );
  const active = unlockedLessons.find((l) => l.id === activeId) ?? null;

  // Ausgangs-Lektion (für die Rückkehr, wenn ein History-Eintrag ohne ?l ist).
  const initialLessonRef = useRef(activeId);
  // Läuft gerade ein "Als Nächstes"-Countdown? (Ziel-Lektions-ID)
  const [pendingNext, setPendingNext] = useState<string | null>(null);

  // Lektion in die URL (?l=…) spiegeln, damit die Zurück-Taste Lektion für
  // Lektion zurückblättert. Native History-API → kein Server-Reload; der
  // Lektionsinhalt liegt bereits vollständig im Client.
  function selectLesson(id: string) {
    setPendingNext(null);
    setActiveId(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("l", id);
      window.history.pushState(window.history.state, "", url);
    } catch {
      // History-API nicht verfügbar – Auswahl gilt trotzdem (nur ohne URL)
    }
  }

  // Vor/Zurück (Popstate) + Deep-Link: aktive Lektion aus der URL übernehmen.
  useEffect(() => {
    const syncFromUrl = () => {
      const id = new URLSearchParams(window.location.search).get("l");
      if (id && unlockedLessons.some((l) => l.id === id)) setActiveId(id);
      else setActiveId(initialLessonRef.current);
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [unlockedLessons]);

  // Beim ersten Laden ein ?l aus der URL respektieren (Lesezeichen/Deep-Link).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("l");
    if (id && id !== activeId && unlockedLessons.some((l) => l.id === id)) {
      // einmalige Deep-Link-Synchronisation beim Mounten
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(id);
    }
    // bewusst nur beim Mounten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoplay ("Lern-Binging"): nach Abschluss automatisch zur nächsten Lektion.
  // Nutzerwahl in localStorage (Default an); nie in eine Prüfung hinein.
  const storedAutoplay = useSyncExternalStore(
    subscribeNever,
    () => window.localStorage.getItem("learn-autoplay"),
    () => null
  );
  const [autoOverride, setAutoOverride] = useState<boolean | null>(null);
  const autoAdvance = autoOverride ?? storedAutoplay !== "0";

  function toggleAutoplay() {
    const next = !autoAdvance;
    setAutoOverride(next);
    try {
      window.localStorage.setItem("learn-autoplay", next ? "1" : "0");
    } catch {
      // localStorage nicht verfügbar – Wahl gilt nur für diese Sitzung
    }
    if (!next) setPendingNext(null);
  }

  // Beim Lektionswechsel oben beginnen (nicht auf alter Scrollposition bleiben)
  const contentRef = useRef<HTMLDivElement>(null);
  const scrolledFromId = useRef(activeId);

  // Jede geöffnete Lektion als letzte Position speichern (fire-and-forget;
  // beim Wiederherstellen schreibt das nur denselben Wert erneut)
  useEffect(() => {
    if (activeId && !previewMode) void markLessonVisited(activeId);
  }, [activeId, previewMode]);

  const lastSavedRef = useRef(0);
  // Sehfortschritt je Medienblock (Maximum je Block, Summe = Lektionsstand)
  const blockSecondsRef = useRef(new Map<string, number>());
  const endedBlocksRef = useRef(new Set<string>());
  // Exakte Abspielposition je Block (letzter Stand, NICHT Maximum)
  const positionsRef = useRef(new Map<string, number>());
  // Für Notizen: zuletzt aktives Medium + Seek-Funktionen der Blöcke
  const lastMediaRef = useRef<{ blockId: string; seconds: number } | null>(
    null
  );
  const seekFnsRef = useRef(new Map<string, (seconds: number) => void>());
  // Heatmap: gesehene Zeit-Buckets – pending bis zum Flush, sent = schon
  // gemeldet (jeder Bucket zählt höchstens einmal pro Sitzung)
  const pendingBucketsRef = useRef(new Map<string, Set<number>>());
  const sentBucketsRef = useRef(new Map<string, Set<number>>());

  // Beim Lektionswechsel Tracking zurücksetzen
  useEffect(() => {
    lastSavedRef.current = 0;
    blockSecondsRef.current = new Map();
    endedBlocksRef.current = new Set();
    positionsRef.current = new Map();
    lastMediaRef.current = null;
    pendingBucketsRef.current = new Map();
    sentBucketsRef.current = new Map();
    // laufenden Countdown eines vorherigen Lektionsendes verwerfen
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingNext(null);
  }, [activeId]);

  /** Heatmap-Zähler melden (fire-and-forget, niemals blockierend). */
  function flushWatchBuckets() {
    if (previewMode) return;
    for (const [blockId, pending] of pendingBucketsRef.current) {
      if (pending.size === 0) continue;
      const buckets = [...pending];
      pending.clear();
      const sent = sentBucketsRef.current.get(blockId) ?? new Set<number>();
      buckets.forEach((b) => sent.add(b));
      sentBucketsRef.current.set(blockId, sent);
      void recordWatchBuckets({ blockId, buckets });
    }
  }

  function trackWatchBucket(blockId: string, seconds: number) {
    const block = active?.blocks.find((b) => b.id === blockId);
    if (!block || block.durationSeconds <= 0) return;
    const bucket = bucketIndexFor(seconds, block.durationSeconds);
    if (bucket < 0) return;
    if (sentBucketsRef.current.get(blockId)?.has(bucket)) return;
    const pending =
      pendingBucketsRef.current.get(blockId) ?? new Set<number>();
    pending.add(bucket);
    pendingBucketsRef.current.set(blockId, pending);
  }

  function saveProgress(lessonId: string, seconds: number, force = false) {
    if (previewMode) return;
    // nur in dieser Sitzung berührte Blöcke mitschicken (Server merged)
    const positions =
      positionsRef.current.size > 0
        ? Object.fromEntries(positionsRef.current)
        : undefined;
    startTransition(async () => {
      await updateLessonProgress({
        lessonId,
        watchedSeconds: Math.floor(seconds),
        forceComplete: force,
        positions,
      });
      router.refresh();
    });
  }

  /** "Erledigt" abwählen – zum erneuten Durcharbeiten der Lektion */
  function resetProgress(lessonId: string) {
    if (previewMode) return;
    startTransition(async () => {
      await resetLessonProgress(lessonId);
      // Client-Tracking verwerfen, sonst speichert der nächste Tick
      // sofort wieder den alten Stand
      blockSecondsRef.current = new Map();
      endedBlocksRef.current = new Set();
      router.refresh();
    });
  }

  function lessonWatchedSum(lesson: LearnLesson): number {
    // Bereits gespeicherter Stand ist die Untergrenze (Server ist monoton)
    let sum = 0;
    for (const value of blockSecondsRef.current.values()) {
      sum += value;
    }
    return Math.max(sum, lesson.watchedSeconds);
  }

  function onMediaTime(blockId: string, seconds: number) {
    if (!active) return;
    const previous = blockSecondsRef.current.get(blockId) ?? 0;
    blockSecondsRef.current.set(blockId, Math.max(previous, seconds));
    positionsRef.current.set(blockId, Math.floor(seconds));
    lastMediaRef.current = { blockId, seconds: Math.floor(seconds) };
    trackWatchBucket(blockId, seconds);
    if (shouldSaveNow(lastSavedRef)) {
      saveProgress(active.id, lessonWatchedSum(active));
      flushWatchBuckets();
    }
  }

  function onMediaPause(blockId: string, seconds: number) {
    if (!active) return;
    const previous = blockSecondsRef.current.get(blockId) ?? 0;
    blockSecondsRef.current.set(blockId, Math.max(previous, seconds));
    positionsRef.current.set(blockId, Math.floor(seconds));
    lastMediaRef.current = { blockId, seconds: Math.floor(seconds) };
    trackWatchBucket(blockId, seconds);
    saveProgress(active.id, lessonWatchedSum(active));
    flushWatchBuckets();
  }

  function onMediaEnded(blockId: string) {
    if (!active) return;
    const block = active.blocks.find((b) => b.id === blockId);
    if (block) {
      blockSecondsRef.current.set(
        blockId,
        Math.max(
          block.durationSeconds,
          blockSecondsRef.current.get(blockId) ?? 0
        )
      );
    }
    endedBlocksRef.current.add(blockId);
    // Zu Ende geschaut: nächstes Mal wieder von vorn statt an der Endsekunde
    positionsRef.current.set(blockId, 0);
    const mediaBlocks = active.blocks.filter(
      (b) => b.type === "VIDEO" || b.type === "AUDIO"
    );
    const allEnded = mediaBlocks.every((b) => endedBlocksRef.current.has(b.id));
    saveProgress(active.id, lessonWatchedSum(active), allEnded);
    flushWatchBuckets();

    // Lektion natürlich zu Ende geschaut → Autoplay-Countdown, ABER nur von
    // Lektion zu Lektion (nie in eine ausstehende Prüfung) und nur, wenn der
    // Nutzer Autoplay aktiv lässt. Manuelles Blättern löst das nie aus.
    if (allEnded && autoAdvance && !previewMode) {
      const flat = viewCourse.sections
        .filter((s) => !s.locked)
        .flatMap((s) => s.lessons);
      const idx = flat.findIndex((l) => l.id === active.id);
      const next = flat[idx + 1];
      const section = viewCourse.sections.find((s) =>
        s.lessons.some((l) => l.id === active.id)
      );
      const isLastInSection = section?.lessons.at(-1)?.id === active.id;
      const checkpoint = Boolean(
        isLastInSection && section?.quiz && !section.quiz.passed
      );
      if (next && !checkpoint) setPendingNext(next.id);
    }
  }

  const hasMedia = active
    ? active.blocks.some((b) => b.type === "VIDEO" || b.type === "AUDIO")
    : false;

  // Ziel der „Weiter"-Leiste am Lektionsende: nächste Lektion → sonst die
  // Zwischenprüfung des Abschnitts → sonst Abschlussprüfung → sonst „geschafft".
  const nav = useMemo<NextTarget>(() => {
    const flat = viewCourse.sections
      .filter((s) => !s.locked)
      .flatMap((s) => s.lessons.map((l) => ({ l, s })));
    const idx = flat.findIndex((x) => x.l.id === activeId);
    if (idx === -1) return { kind: "none" };
    const cur = flat[idx];
    const next = flat[idx + 1];
    const isLastInSection = cur.s.lessons.at(-1)?.id === activeId;
    // Mitten im Kurs: Abschnitt beendet, Zwischenprüfung offen, es folgen aber
    // noch Lektionen → sanfter Hinweis zur Zwischenprüfung.
    if (next && isLastInSection && cur.s.quiz && !cur.s.quiz.passed && !previewMode) {
      return { kind: "quiz", quizId: cur.s.quiz.id, title: cur.s.quiz.title };
    }
    if (next) return { kind: "lesson", id: next.l.id, title: next.l.title };
    // Kursende: Abschlussprüfung IMMER zeigen (auch gesperrt, mit Bedingungen).
    if (course.finalExamRequired && course.finalQuiz && !previewMode) {
      return { kind: "exam", quizId: course.finalQuiz.id };
    }
    return { kind: "done" };
  }, [
    viewCourse,
    activeId,
    previewMode,
    course.finalExamRequired,
    course.finalQuiz,
  ]);

  function goToLesson(id: string) {
    selectLesson(id);
  }

  // Freischalt-Bedingungen der Abschlussprüfung (Spiegel von isEligibleForExam):
  // genug gesehen UND alle Zwischenprüfungen bestanden.
  const currentWatch = Math.round(watchPercent);
  const quizzesTotal = course.sections.filter((s) => s.quiz).length;
  const quizzesPassed = course.sections.filter(
    (s) => s.quiz && s.quiz.passed
  ).length;
  const examState = {
    passed: certificateSerial !== null,
    eligible: examEligible,
    watchDone: currentWatch >= course.requiredWatchPercent,
    requiredWatch: course.requiredWatchPercent,
    currentWatch,
    quizzesTotal,
    quizzesPassed,
    quizzesDone: quizzesTotal === 0 || quizzesPassed === quizzesTotal,
  };

  // Favoriten: optimistisch umschalten, bei Server-Fehler zurückrollen
  const [favorites, setFavorites] = useState<Set<string>>(
    () =>
      new Set(
        course.sections
          .flatMap((s) => s.lessons)
          .filter((l) => l.favorite)
          .map((l) => l.id)
      )
  );
  function onToggleFavorite(lessonId: string) {
    const next = !favorites.has(lessonId);
    setFavorites((prev) => {
      const set = new Set(prev);
      if (next) set.add(lessonId);
      else set.delete(lessonId);
      return set;
    });
    // Vorschau: Favoriten nur lokal spiegeln, nichts speichern
    if (previewMode) return;
    void toggleLessonFavorite(lessonId).then((result) => {
      if (!result.ok) {
        setFavorites((prev) => {
          const set = new Set(prev);
          if (next) set.delete(lessonId);
          else set.add(lessonId);
          return set;
        });
      }
    });
  }

  // Fokus-Modus: Inhalt als Vollbild-Ebene, Esc beendet, Seite dahinter
  // scrollt nicht mit
  const [focusMode, setFocusMode] = useState(false);
  // während des Toggles trägt die Spalte ihren view-transition-name
  const [vtActive, setVtActive] = useState(false);
  // Umschalten als View Transition: flushSync stellt sicher, dass der neue
  // Zustand im DOM steht, bevor der Browser den jeweiligen Frame aufnimmt
  const toggleFocus = (next: boolean) => {
    flushSync(() => setVtActive(true));
    withViewTransition(
      () => flushSync(() => setFocusMode(next)),
      () => setVtActive(false)
    );
  };
  // Nur bei echtem Lektionswechsel nach oben scrollen – nicht beim Fokus-Toggle
  // (der morpht die Spalte per View Transition an Ort und Stelle).
  useEffect(() => {
    if (scrolledFromId.current === activeId) return;
    scrolledFromId.current = activeId;
    const el = contentRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
      ? "auto"
      : "smooth";
    if (focusMode) {
      // Fokus-Modus: die Inhaltsspalte ist selbst der Scroll-Container
      el.scrollTo({ top: 0, behavior });
    } else {
      // Normal: Fenster scrollen (scrollIntoView greift hier nicht zuverlässig
      // durch die Overflow-Vorfahren) – Lektionsanfang unter den Sticky-Header.
      const top = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: Math.max(0, top), behavior });
    }
  }, [activeId, focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") toggleFocus(false);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [focusMode]);

  return (
    <Wrap id="main">
      <Container>
        {previewMode ? (
          <PreviewBanner role="status">
            <strong>👁 {t("previewTitle")}</strong>
            <span className="hint">{t("previewHint")}</span>
            <Link
              href={{
                pathname: "/creator/courses/[id]",
                params: { id: courseId },
              }}
            >
              {t("previewExit")} ↗
            </Link>
          </PreviewBanner>
        ) : null}
        <TopBar>
          <div>
            <Kicker>{viewCourse.title}</Kicker>
            <h1>{active?.title ?? viewCourse.title}</h1>
          </div>
          <ProgressWrap>
            <span>{t("watched", { percent: Math.round(watchPercent) })}</span>
            <ProgressBar percent={watchPercent} label={t("progress")} />
          </ProgressWrap>
        </TopBar>

        {/* Lernpfad als 3D-Journey: eine Station je Abschnitt, Klick springt
            dorthin – dekorativ (aria-hidden), Navigation bleibt die Sidebar */}
        {!focusMode ? (
          <JourneyPath3D
            title={t("journeyTitle")}
            hint={t("journeyHint")}
            sections={viewCourse.sections.map((section) => ({
              id: section.id,
              title: section.title,
              percent: courseWatchPercent(
                section.lessons.map((lesson) => ({
                  durationSeconds: lesson.durationSeconds,
                  watchedSeconds: lesson.watchedSeconds,
                }))
              ),
              completed:
                section.lessons.length > 0 &&
                section.lessons.every((lesson) => lesson.completed),
              locked: section.locked,
              hasQuiz: section.quiz !== null,
              quizPassed: section.quizState?.passed ?? false,
              quizNextAttemptAt: section.quizState?.nextAttemptAt ?? null,
              quizExhausted: section.quizState?.exhausted ?? false,
            }))}
            finalExam={
              course.finalExamRequired && course.finalQuiz
                ? {
                    title: t("examSectionTitle"),
                    passed: certificateSerial !== null,
                    unlocked: examEligible,
                  }
                : null
            }
            onSelectSection={(sectionId) => {
              const section = viewCourse.sections.find(
                (s) => s.id === sectionId
              );
              if (!section || section.locked) return;
              const target =
                section.lessons.find((lesson) => !lesson.completed) ??
                section.lessons[0];
              if (target) selectLesson(target.id);
            }}
          />
        ) : null}

        <Layout>
          <SidebarColumn>
          <Sidebar aria-label={t("progress")}>
            {viewCourse.sections.map((section) => (
              <div key={section.id}>
                <SectionTitleRow>
                  {section.locked ? <span aria-hidden>🔒 </span> : null}
                  {section.title}
                </SectionTitleRow>
                {section.locked ? (
                  <LockHint role="note">
                    {section.unlocksAt
                      ? t("dripLockedUntil", {
                          date: new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                          }).format(new Date(section.unlocksAt)),
                        })
                      : null}
                    {section.unlocksAt && section.requiresPreviousQuiz
                      ? " · "
                      : null}
                    {section.requiresPreviousQuiz ? t("dripLockedQuiz") : null}
                  </LockHint>
                ) : null}
                {section.locked
                  ? section.lessons.map((lesson) => (
                      <LockedLessonRow key={lesson.id}>
                        <Check $done={false} aria-hidden />
                        <span style={{ flex: 1 }}>{lesson.title}</span>
                        {lesson.durationSeconds > 0 ? (
                          <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                            {formatDuration(lesson.durationSeconds)}
                          </span>
                        ) : null}
                      </LockedLessonRow>
                    ))
                  : section.lessons.map((lesson) => (
                  <LessonButton
                    key={lesson.id}
                    $active={lesson.id === activeId}
                    aria-current={lesson.id === activeId ? "true" : undefined}
                    onClick={() => selectLesson(lesson.id)}
                  >
                    <Check $done={lesson.completed} aria-hidden>
                      {lesson.completed ? "✓" : ""}
                    </Check>
                    <span style={{ flex: 1 }}>{lesson.title}</span>
                    {favorites.has(lesson.id) ? (
                      <FavoriteStar title={t("favorite")}>★</FavoriteStar>
                    ) : null}
                    {lesson.durationSeconds > 0 ? (
                      <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                        {formatDuration(lesson.durationSeconds)}
                      </span>
                    ) : null}
                  </LessonButton>
                ))}
                {section.quiz && !section.locked ? (
                  previewMode ? (
                    <QuizRowStatic
                      aria-disabled="true"
                      title={t("previewInteractiveHint")}
                      style={{ opacity: 0.6 }}
                    >
                      <span>✦ {t("sectionQuiz")}</span>
                      <Badge $tone="muted">{t("previewLabel")}</Badge>
                    </QuizRowStatic>
                  ) : (
                    <QuizRow
                      href={{
                        pathname: "/learn/[slug]/quiz/[quizId]",
                        params: { slug: course.slug, quizId: section.quiz.id },
                      }}
                    >
                      <span>✦ {t("sectionQuiz")}</span>
                      <Badge $tone={section.quiz.passed ? "success" : "muted"}>
                        {section.quiz.passed
                          ? t("quizPassed")
                          : t("quizNotPassed")}
                      </Badge>
                    </QuizRow>
                  )
                ) : null}
              </div>
            ))}

            {/* Abschlussprüfung + Zertifikat: Menüpunkt ganz unten – die
                Prüfungsseite zeigt Ergebnis, Zertifikat bzw. die Prüfung */}
            {course.finalExamRequired && course.finalQuiz ? (
              previewMode ? (
                <ExamNavRowStatic
                  aria-disabled="true"
                  title={t("previewInteractiveHint")}
                  style={{ opacity: 0.6 }}
                >
                  <span>🎓 {t("examSectionTitle")}</span>
                  <Badge $tone="muted">{t("previewLabel")}</Badge>
                </ExamNavRowStatic>
              ) : (
                <ExamNavRow
                  href={{
                    pathname: "/learn/[slug]/quiz/[quizId]",
                    params: { slug: course.slug, quizId: course.finalQuiz.id },
                  }}
                >
                  <span>🎓 {t("examSectionTitle")}</span>
                  <Badge
                    $tone={
                      certificateSerial
                        ? "success"
                        : examEligible
                          ? "accent"
                          : "muted"
                    }
                  >
                    {certificateSerial
                      ? t("examPassedBadge")
                      : examEligible
                        ? t("examUnlocked")
                        : t("examLocked")}
                  </Badge>
                </ExamNavRow>
              )
            ) : null}
          </Sidebar>

          {course.languages.length > 1 ? (
            <LangCard>
              <span id="course-lang-label">{t("courseLanguage")}</span>
              <LangSwitch role="group" aria-labelledby="course-lang-label">
                {course.languages.map((lang) => (
                  <LangSwitchButton
                    key={lang}
                    type="button"
                    $active={contentLang === lang}
                    aria-pressed={contentLang === lang}
                    onClick={() => changeContentLang(lang)}
                  >
                    {lang.toUpperCase()}
                  </LangSwitchButton>
                ))}
              </LangSwitch>
            </LangCard>
          ) : null}

          {course.bookingEnabled ? <BookingCard courseId={courseId} /> : null}
          </SidebarColumn>

          <ContentColumn ref={contentRef} $focus={focusMode} $vt={vtActive}>
            {focusMode ? (
              <FocusExit
                type="button"
                onClick={() => toggleFocus(false)}
                aria-label={t("focusExit")}
              >
                ✕ {t("focusExit")}
              </FocusExit>
            ) : null}
            {active ? (
              <Stage aria-live="polite">
                <LessonHeader>
                  <h2>{active.title}</h2>
                  <LessonTools>
                    <ToolbarButton
                      type="button"
                      $active={favorites.has(active.id)}
                      aria-pressed={favorites.has(active.id)}
                      onClick={() => onToggleFavorite(active.id)}
                      title={
                        favorites.has(active.id)
                          ? t("favoriteRemove")
                          : t("favoriteAdd")
                      }
                    >
                      {favorites.has(active.id) ? "★" : "☆"} {t("favorite")}
                    </ToolbarButton>
                    {!focusMode ? (
                      <ToolbarButton
                        type="button"
                        aria-pressed={focusMode}
                        onClick={() => toggleFocus(true)}
                        title={t("focusHint")}
                      >
                        ⛶ {t("focusMode")}
                      </ToolbarButton>
                    ) : null}
                    <ToolbarButton
                      type="button"
                      $active={autoAdvance}
                      aria-pressed={autoAdvance}
                      onClick={toggleAutoplay}
                      title={
                        autoAdvance ? t("autoplayOnHint") : t("autoplayOffHint")
                      }
                    >
                      {autoAdvance ? "⏭" : "⏸"} {t("autoplay")}
                    </ToolbarButton>
                    {active.blocks.some(
                      (b) => b.type === "TEXT" && b.content.trim()
                    ) ? (
                      <ReadAloud lessonId={active.id} lang={contentLang} />
                    ) : null}
                  </LessonTools>
                </LessonHeader>

                <div key={active.id}>
                  <BlockRenderer
                    blocks={active.blocks}
                    positions={active.positions}
                    media={{
                      onTime: onMediaTime,
                      onPause: onMediaPause,
                      onEnded: onMediaEnded,
                    }}
                    registerSeek={(blockId, fn) => {
                      if (fn) seekFnsRef.current.set(blockId, fn);
                      else seekFnsRef.current.delete(blockId);
                    }}
                  />
                  {course.selfTestsEnabled &&
                  (active.selfTest[contentLang] ?? false) ? (
                    <SelfTest lessonId={active.id} lang={contentLang} />
                  ) : null}
                  <LessonNotes
                    key={`notes-${active.id}`}
                    lessonId={active.id}
                    lessonTitle={active.title}
                    getStamp={() => lastMediaRef.current}
                    onSeek={(blockId, seconds) =>
                      seekFnsRef.current.get(blockId)?.(seconds)
                    }
                  />
                </div>

                {!hasMedia && !active.completed ? (
                  <div style={{ marginTop: "1.25rem" }}>
                    <GhostButton
                      onClick={() => saveProgress(active.id, 1, true)}
                    >
                      ✓ {t("markComplete")}
                    </GhostButton>
                  </div>
                ) : null}
                {active.completed ? (
                  <div
                    style={{
                      marginTop: "1.25rem",
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                    }}
                  >
                    <Badge $tone="success">{t("completed")}</Badge>
                    <GhostButton onClick={() => resetProgress(active.id)}>
                      ↺ {t("markIncomplete")}
                    </GhostButton>
                  </div>
                ) : null}

                {/* Lektionsende: ein Klick zum nächsten Schritt bzw. die
                    Abschlussprüfung als sichtbare Ziellinie mit Bedingungen */}
                {nav.kind === "lesson" ? (
                  <NextBar>
                    <NextPrimary
                      type="button"
                      onClick={() => goToLesson(nav.id)}
                    >
                      {t("nextLessonNamed", { title: nav.title })} →
                    </NextPrimary>
                  </NextBar>
                ) : nav.kind === "quiz" ? (
                  <NextBar>
                    <NextPrimary
                      as={Link}
                      href={{
                        pathname: "/learn/[slug]/quiz/[quizId]",
                        params: { slug: course.slug, quizId: nav.quizId },
                      }}
                    >
                      ✦ {t("toSectionQuiz")} →
                    </NextPrimary>
                  </NextBar>
                ) : nav.kind === "exam" ? (
                  <ExamGate>
                    <ExamHead>
                      <strong>🎓 {t("examSectionTitle")}</strong>
                      {examState.passed ? (
                        <NextPrimary
                          as={Link}
                          href={{
                            pathname: "/learn/[slug]/quiz/[quizId]",
                            params: { slug: course.slug, quizId: nav.quizId },
                          }}
                        >
                          {t("examCertificateCta")} →
                        </NextPrimary>
                      ) : examState.eligible ? (
                        <NextPrimary
                          as={Link}
                          href={{
                            pathname: "/learn/[slug]/quiz/[quizId]",
                            params: { slug: course.slug, quizId: nav.quizId },
                          }}
                        >
                          {t("toExam")} →
                        </NextPrimary>
                      ) : (
                        <PrimaryButton
                          type="button"
                          disabled
                          aria-describedby="exam-reqs"
                        >
                          {t("toExam")}
                        </PrimaryButton>
                      )}
                    </ExamHead>
                    {!examState.passed && !examState.eligible ? (
                      <>
                        <ExamHint>{t("examLockedIntro")}</ExamHint>
                        <ReqList id="exam-reqs">
                          <li data-done={examState.watchDone ? "true" : "false"}>
                            <Check $done={examState.watchDone} aria-hidden>
                              {examState.watchDone ? "✓" : ""}
                            </Check>
                            <span>
                              {t("examWatchReq", {
                                required: examState.requiredWatch,
                                current: examState.currentWatch,
                              })}
                            </span>
                          </li>
                          {examState.quizzesTotal > 0 ? (
                            <li
                              data-done={
                                examState.quizzesDone ? "true" : "false"
                              }
                            >
                              <Check $done={examState.quizzesDone} aria-hidden>
                                {examState.quizzesDone ? "✓" : ""}
                              </Check>
                              <span>
                                {t("examQuizReq", {
                                  passed: examState.quizzesPassed,
                                  total: examState.quizzesTotal,
                                })}
                              </span>
                            </li>
                          ) : null}
                        </ReqList>
                      </>
                    ) : null}
                  </ExamGate>
                ) : nav.kind === "done" ? (
                  <NextBar>
                    <DoneNote>🎉 {t("courseEndReached")}</DoneNote>
                  </NextBar>
                ) : null}

                <LessonCommunity lessonId={active.id} viewer={community} />
              </Stage>
            ) : null}

            <div style={{ marginTop: "1.5rem" }}>
              <RatingWidget
                courseId={courseId}
                initialRating={myRating}
                initialComment={myComment}
              />
            </div>
          </ContentColumn>
        </Layout>
      </Container>

      {active ? (
        <AssistantDock
          lessonId={active.id}
          lang={contentLang}
          onJumpToLesson={(id) => selectLesson(id)}
        />
      ) : null}

      {/* "Als Nächstes"-Countdown nach natürlichem Lektionsabschluss */}
      {pendingNext && !previewMode ? (
        <UpNextCountdown
          title={
            unlockedLessons.find((l) => l.id === pendingNext)?.title ?? ""
          }
          onAdvance={() => goToLesson(pendingNext)}
          onCancel={() => setPendingNext(null)}
        />
      ) : null}
    </Wrap>
  );
}
