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
import { useLocale, useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";
import { Link, useRouter } from "@/i18n/navigation";
import { courseWatchPercent } from "@elearning/core/progress";
import {
  markLessonVisited,
  resetLessonProgress,
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
} from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ui/ProgressBar";

const Wrap = styled.main`
  padding: 2.5rem 0 2rem;
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

const QuizRow = styled(Link)`
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
  padding: 1.5rem;
  background: ${({ theme }) => theme.colors.surface};

  h2 {
    font-size: 1.4rem;
    margin-bottom: 1rem;
  }
`;

/**
 * Fokus-Modus: Die Inhalts-Spalte legt sich als Vollbild-Ebene über die
 * Seite (gleiche DOM-Knoten – laufende Videos werden nicht neu gemountet),
 * mit Ambient-Glow hinter dem Inhalt. Esc oder ✕ beendet.
 */
const ContentColumn = styled.div<{ $focus: boolean }>`
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

const FocusExit = styled.button`
  position: fixed;
  top: 0.9rem;
  right: 1rem;
  z-index: 90;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.85rem;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

/* Menüpunkt „Abschlussprüfung & Zertifikat" ganz unten in der Kurs-Sidebar */
const ExamNavRow = styled(Link)`
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

interface LearnLesson {
  id: string;
  title: string;
  translations?: unknown;
  durationSeconds: number;
  watchedSeconds: number;
  completed: boolean;
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
const JourneyPath3D = dynamic(
  () => import("./JourneyPath3D").then((m) => m.JourneyPath3D),
  { ssr: false }
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
  const unlockedLessons = viewCourse.sections
    .filter((s) => !s.locked)
    .flatMap((s) => s.lessons);
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

  // Jede geöffnete Lektion als letzte Position speichern (fire-and-forget;
  // beim Wiederherstellen schreibt das nur denselben Wert erneut)
  useEffect(() => {
    if (activeId) void markLessonVisited(activeId);
  }, [activeId]);

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
  }, [activeId]);

  /** Heatmap-Zähler melden (fire-and-forget, niemals blockierend). */
  function flushWatchBuckets() {
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
  }

  const hasMedia = active
    ? active.blocks.some((b) => b.type === "VIDEO" || b.type === "AUDIO")
    : false;

  // Fokus-Modus: Inhalt als Vollbild-Ebene, Esc beendet, Seite dahinter
  // scrollt nicht mit
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
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
              if (target) setActiveId(target.id);
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
                    onClick={() => setActiveId(lesson.id)}
                  >
                    <Check $done={lesson.completed} aria-hidden>
                      {lesson.completed ? "✓" : ""}
                    </Check>
                    <span style={{ flex: 1 }}>{lesson.title}</span>
                    {lesson.durationSeconds > 0 ? (
                      <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                        {formatDuration(lesson.durationSeconds)}
                      </span>
                    ) : null}
                  </LessonButton>
                ))}
                {section.quiz && !section.locked ? (
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
                ) : null}
              </div>
            ))}

            {/* Abschlussprüfung + Zertifikat: Menüpunkt ganz unten – die
                Prüfungsseite zeigt Ergebnis, Zertifikat bzw. die Prüfung */}
            {course.finalExamRequired && course.finalQuiz ? (
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

          <ContentColumn $focus={focusMode}>
            {focusMode ? (
              <FocusExit
                type="button"
                onClick={() => setFocusMode(false)}
                aria-label={t("focusExit")}
              >
                ✕ {t("focusExit")}
              </FocusExit>
            ) : null}
            {active ? (
              <Stage aria-live="polite">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  <h2>{active.title}</h2>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {!focusMode ? (
                      <GhostButton
                        type="button"
                        aria-pressed={focusMode}
                        onClick={() => setFocusMode(true)}
                        title={t("focusHint")}
                      >
                        ⛶ {t("focusMode")}
                      </GhostButton>
                    ) : null}
                    {active.blocks.some(
                      (b) => b.type === "TEXT" && b.content.trim()
                    ) ? (
                      <ReadAloud lessonId={active.id} lang={contentLang} />
                    ) : null}
                  </div>
                </div>

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
          onJumpToLesson={(id) => setActiveId(id)}
        />
      ) : null}
    </Wrap>
  );
}
