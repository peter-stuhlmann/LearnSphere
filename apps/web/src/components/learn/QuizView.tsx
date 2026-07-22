"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";
import { motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import { formatDuration } from "@elearning/core/format";
import {
  submitQuiz,
  type QuizSubmissionResult,
} from "@/app/actions/learning-actions";
import { waiveRefundGuarantee } from "@/app/actions/refund-actions";
import {
  Badge,
  Card,
  Container,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { FormAlert } from "@/components/auth/AuthShell";
import { ExamSignal, type SignalLevel } from "./ExamSignal";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const QuestionCard = styled(Card)`
  margin-top: 1.25rem;

  h2 {
    font-size: 1.15rem;
    margin-bottom: 1rem;
  }
`;

const QuestionMeta = styled.p`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-bottom: 0.4rem;
`;

const OptionLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.8rem 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  margin-bottom: 0.6rem;
  cursor: pointer;
  font-size: 0.95rem;
  transition: border-color 150ms ease, background 150ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
    background: ${({ theme }) => theme.colors.surface};
  }

  &:has(input:checked) {
    border-color: ${({ theme }) => theme.colors.accent};
    background: ${({ theme }) => theme.colors.accentSoft};
  }

  input {
    margin-top: 0.2rem;
    width: 18px;
    height: 18px;
    accent-color: ${({ theme }) => theme.colors.accent};
  }
`;

const ResultCard = styled(motion.div)<{ $passed: boolean }>`
  margin-top: 2rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid
    ${({ theme, $passed }) =>
      $passed ? theme.colors.success : theme.colors.danger};
  background: ${({ theme, $passed }) =>
    $passed ? theme.colors.successSoft : theme.colors.dangerSoft};
  padding: 2.5rem 1.75rem;
  text-align: center;

  h2 {
    font-size: clamp(1.8rem, 5vw, 2.6rem);
  }

  p {
    margin-top: 0.75rem;
  }
`;

const Score = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 3.2rem;
  margin-top: 1rem !important;
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  justify-content: center;
  margin-top: 1.75rem;
`;

/* Detailauswertung nach der Abgabe: was war richtig, was falsch */
const DetailList = styled.ol`
  list-style: none;
  margin: 1.75rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  text-align: left;
`;

const DetailItem = styled.li<{ $correct: boolean }>`
  border: 1px solid
    ${({ theme, $correct }) =>
      $correct ? "rgba(200, 255, 77, 0.35)" : theme.colors.danger};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  padding: 0.9rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  strong {
    font-size: 0.95rem;
  }
`;

const DetailMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const DetailAnswer = styled.p`
  margin: 0 !important;
  font-size: 0.88rem;
  color: ${({ theme }) => theme.colors.textMuted};

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.text};
  }
`;

const CertButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  font-weight: 700;
  padding: 0.85rem 1.6rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  text-decoration: none;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  color: ${({ theme }) => theme.colors.text};
  padding: 0.85rem 1.6rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  text-decoration: none;
`;

const timerPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.45); }
  50% { box-shadow: 0 0 0 8px rgba(255, 107, 107, 0); }
`;

/* Timer und Signalampel wandern gemeinsam mit – beides muss während der
   ganzen Prüfung sichtbar bleiben, nicht nur ganz oben auf der Seite. */
const StatusRow = styled.div`
  position: sticky;
  top: 74px;
  z-index: 10;
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
`;

const TimerBadge = styled.div<{ $urgent: boolean }>`
  width: max-content;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.bgDeep};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;

  ${({ $urgent, theme }) =>
    $urgent
      ? css`
          border: 1px solid rgba(255, 107, 107, 0.6);
          color: ${theme.colors.danger};
          animation: ${timerPulse} 1.6s ease-in-out infinite;
        `
      : css`
          border: 1px solid rgba(200, 255, 77, 0.4);
          color: ${theme.colors.accent};
        `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/* ---------- Anti-Schummel-Maßnahmen (laufende Prüfung) ---------- */

/** Nach 2 Warnungen wird beim 3. Verlassen automatisch abgegeben. */
const MAX_TAB_LEAVES = 3;

/** Beschriftung der Ampel je Stufe (0 = ruhig, 1 = gestört, 2 = kritisch) */
const SIGNAL_LABELS = [
  "signalStable",
  "signalDisturbed",
  "signalCritical",
] as const;

/* Fragen/Antworten nicht markier-/kopierbar; Freitext bleibt bedienbar */
const GuardedForm = styled.form`
  position: relative;
  user-select: none;
  -webkit-user-select: none;

  textarea {
    user-select: text;
    -webkit-user-select: text;
  }
`;

const LeaveOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(7, 8, 15, 0.85);
  backdrop-filter: blur(4px);
`;

const LeaveDialog = styled.div<{ $critical: boolean }>`
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  max-width: 480px;
  padding: 2rem 1.75rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid
    ${({ $critical, theme }) =>
      $critical ? theme.colors.danger : "rgba(245, 197, 66, 0.55)"};
  /* schwaches Leuchten aus der Tiefe – passend zur Signalstation */
  background: radial-gradient(
        ellipse 80% 60% at 50% 0%,
        ${({ $critical }) =>
          $critical ? "rgba(255, 107, 107, 0.14)" : "rgba(245, 197, 66, 0.12)"},
        transparent 70%
      )
      ${({ theme }) => theme.colors.bgDeep};
  text-align: center;

  h2 {
    margin-top: 0.9rem;
    font-size: 1.3rem;
    color: ${({ $critical, theme }) =>
      $critical ? theme.colors.danger : "#F5C542"};
  }

  p {
    margin: 0.75rem 0 1.25rem;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.95rem;
  }
`;

const FreeTextInput = styled.textarea`
  width: 100%;
  min-height: 110px;
  resize: vertical;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.85rem 1rem;
  font-size: 0.95rem;
  line-height: 1.6;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

interface QuizViewQuestion {
  id: string;
  text: string;
  kind: "SINGLE" | "MULTIPLE" | "FREE_TEXT";
  /** Gewichtung in der Bewertung */
  points: number;
  options: { id: string; text: string }[];
}

export interface AttemptState {
  blocked:
    | "already_passed"
    | "attempts_exhausted"
    | "cooldown"
    | "guarantee"
    | "not_eligible"
    | null;
  nextAttemptAt?: string | null;
  /** Ende der 30-Tage-Rückgabegarantie (nur bei blocked === "guarantee") */
  guaranteeUntil?: string | null;
  /** nötige Sehquote (nur bei blocked === "not_eligible") */
  requiredWatchPercent?: number;
  usedAttempts: number;
  maxAttempts: number | null;
}

interface QuizViewProps {
  quiz: {
    id: string;
    title: string;
    kind: "SECTION" | "FINAL";
    passPercent: number;
    courseId: string;
    courseSlug: string;
    courseTitle: string;
    questions: QuizViewQuestion[];
  };
  attemptState: AttemptState;
  /** Restzeit in Sekunden bei Zeitlimit; null = ohne Begrenzung */
  remainingSeconds: number | null;
  /** Gespeichertes Ergebnis des letzten (bestandenen) Versuchs – der
   *  Ergebnis-Screen übersteht so auch einen Reload */
  initialResult: { scorePercent: number; certificateSerial: string | null } | null;
  /** Darf laut Wiederholungsregeln ein neuer Versuch gestartet werden? */
  canRetry: boolean;
}

export function QuizView({
  quiz,
  attemptState,
  remainingSeconds,
  initialResult,
  canRetry,
}: QuizViewProps) {
  const t = useTranslations("exam");
  const locale = useLocale();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizSubmissionResult | null>(
    initialResult
      ? {
          ok: true,
          passed: true,
          scorePercent: initialResult.scorePercent,
          certificateSerial: initialResult.certificateSerial ?? undefined,
        }
      : null
  );
  // Nach einer Abgabe in dieser Sitzung liegt serverseitig schon ein
  // Versuch mehr vor als in attemptState – wichtig für den Retry-Token
  const submittedNow = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState(remainingSeconds);
  const [showDetails, setShowDetails] = useState(false);
  const [waiveConfirm, setWaiveConfirm] = useState(false);
  const autoSubmitted = useRef(false);

  // Anti-Schummeln: Tab-Verlassen zählen (2 Warnungen, dann Auto-Abgabe)
  const [leaveWarning, setLeaveWarning] = useState<number | null>(null);
  /* Derselbe Zähler auch als State – die Ampel muss ihn dauerhaft anzeigen,
     nicht nur im Moment des Verstoßes. */
  const [leaves, setLeaves] = useState(0);
  const signalLevel: SignalLevel = Math.min(2, leaves) as SignalLevel;
  const leaveCountRef = useRef(0);
  const lastLeaveAtRef = useRef(0);
  const examActive = !result && !attemptState.blocked;
  const examActiveRef = useRef(examActive);
  const forceSubmitRef = useRef<() => void>(() => {});

  /** Rückgabegarantie freiwillig beenden → Prüfung wird sofort freigeschaltet */
  function onWaiveGuarantee() {
    startTransition(async () => {
      const res = await waiveRefundGuarantee({ courseId: quiz.courseId });
      if (!res.ok) {
        setError(res.error ?? "generic");
        return;
      }
      router.refresh();
    });
  }

  // Anti-Schummeln: Tab-/Fensterwechsel während der laufenden Prüfung
  // erkennen. Verlassen lässt sich im Browser nicht verhindern – aber
  // sanktionieren: 2 Warnungen, beim 3. Verstoß automatische Abgabe.
  useEffect(() => {
    if (!examActive) return;

    function onViolation() {
      if (!examActiveRef.current) return;
      // visibilitychange + blur feuern oft gemeinsam → nur 1× zählen
      const now = Date.now();
      if (now - lastLeaveAtRef.current < 1500) return;
      lastLeaveAtRef.current = now;

      leaveCountRef.current += 1;
      setLeaves(leaveCountRef.current);
      if (leaveCountRef.current >= MAX_TAB_LEAVES) {
        setLeaveWarning(null);
        forceSubmitRef.current();
      } else {
        setLeaveWarning(leaveCountRef.current);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") onViolation();
    }
    function onBlur() {
      onViolation();
    }
    function onKeyUp(event: KeyboardEvent) {
      // PrintScreen lässt sich nicht verhindern – aber wir leeren die
      // Zwischenablage (Best Effort) als Abschreckung
      if (event.key === "PrintScreen") {
        navigator.clipboard?.writeText("").catch(() => {});
      }
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [examActive]);

  // Live-Countdown: tickt sekündlich, solange die Prüfung offen ist
  useEffect(() => {
    if (secondsLeft === null || result || attemptState.blocked) return;
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Interval nur an Laufzustand koppeln
  }, [secondsLeft === null, secondsLeft === 0, result, attemptState.blocked]);

  function toggle(questionId: string, optionId: string, single: boolean) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (single) {
        return { ...prev, [questionId]: [optionId] };
      }
      return {
        ...prev,
        [questionId]: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      };
    });
  }

  function doSubmit(force: boolean) {
    setError(null);

    // Auto-Abgabe bei Zeitablauf reicht auch unvollständige Antworten ein
    if (!force) {
      const unanswered = quiz.questions.some((q) =>
        q.kind === "FREE_TEXT"
          ? !(answers[q.id]?.[0] ?? "").trim()
          : (answers[q.id] ?? []).length === 0
      );
      if (unanswered) {
        setError(t("selectAnswer"));
        return;
      }
    }

    startTransition(async () => {
      const res = await submitQuiz({ quizId: quiz.id, answers });
      if (!res.ok) {
        switch (res.error) {
          case "not_eligible":
            setError(t("notEligible"));
            break;
          case "guarantee_active":
            setError(t("guaranteeBlockedShort"));
            break;
          case "attempt_already_passed":
            setError(t("blockedAlreadyPassed"));
            break;
          case "attempts_exhausted":
            setError(t("blockedExhausted"));
            break;
          case "attempt_cooldown":
            setError(
              t("blockedCooldown", {
                date: res.nextAttemptAt
                  ? new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(res.nextAttemptAt))
                  : "…",
              })
            );
            break;
          case "time_expired":
            setError(t("timeExpired"));
            break;
          default:
            setError(res.error ?? null);
        }
        return;
      }
      submittedNow.current = true;
      setResult(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /**
   * Neuer Versuch = neue Server-Runde: Navigation mit ?retry=<Versuchszahl>
   * remountet die Seite mit frisch gemischten Fragen, zurückgesetztem
   * Countdown und leeren Antworten. Der Token ist an den Versuchszähler
   * gebunden – nach der nächsten Abgabe ist er automatisch ungültig, sodass
   * ein Reload wieder das gespeicherte Ergebnis zeigt.
   */
  function startNewAttempt() {
    startTransition(() => {
      router.replace({
        pathname: "/learn/[slug]/quiz/[quizId]",
        params: { slug: quiz.courseSlug, quizId: quiz.id },
        query: {
          retry: attemptState.usedAttempts + (submittedNow.current ? 1 : 0),
        },
      });
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    doSubmit(false);
  }
  // aktuellste doSubmit-Version + Laufzustand für die Tab-Verlassen-Sanktion
  // (Refs dürfen nur außerhalb des Renders beschrieben werden)
  useEffect(() => {
    examActiveRef.current = examActive && !pending;
    forceSubmitRef.current = () => doSubmit(true);
  });

  // Zeit abgelaufen → aktuelle Antworten automatisch abgeben (einmalig)
  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmitted.current && !result) {
      autoSubmitted.current = true;
      doSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur auf den Ablauf reagieren
  }, [secondsLeft, result]);

  const linkedInUrl =
    result?.certificateSerial != null
      ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
          quiz.courseTitle
        )}&organizationName=LearnSphere&certId=${result.certificateSerial}`
      : null;

  if (result) {
    const passed = result.passed === true;
    const resultByQuestion = new Map(
      (result.perQuestion ?? []).map((r) => [r.questionId, r])
    );
    /** Gegebene Antwort als lesbarer Text (Optionstexte bzw. Freitext) */
    const answerText = (q: QuizViewQuestion): string => {
      const given = answers[q.id] ?? [];
      if (q.kind === "FREE_TEXT") return (given[0] ?? "").trim();
      return given
        .map((id) => q.options.find((o) => o.id === id)?.text ?? "")
        .filter(Boolean)
        .join(", ");
    };
    return (
      <Wrap id="main">
        <Container>
          <ResultCard
            $passed={passed}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            role="status"
          >
            <h2>{passed ? t("resultPassedTitle") : t("resultFailedTitle")}</h2>
            <Score>{result.scorePercent}%</Score>
            <Muted>
              {t("neededScore", { percent: quiz.passPercent })}
              {result.totalPoints ? (
                <>
                  {" · "}
                  {t("pointsEarned", {
                    earned: result.earnedPoints ?? 0,
                    total: result.totalPoints,
                  })}
                </>
              ) : null}
            </Muted>

            <ActionRow>
              {passed && result.certificateSerial ? (
                <>
                  <CertButton
                    href={`/api/certificates/${result.certificateSerial}?lang=${locale}&mode=light`}
                  >
                    ⬇ {t("downloadCertificateLight")}
                  </CertButton>
                  <CertButton
                    href={`/api/certificates/${result.certificateSerial}?lang=${locale}&mode=dark`}
                  >
                    ⬇ {t("downloadCertificateDark")}
                  </CertButton>
                  {linkedInUrl ? (
                    <CertButton
                      href={linkedInUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: "#0A66C2", color: "#fff" }}
                    >
                      in {t("addToLinkedIn")}
                    </CertButton>
                  ) : null}
                </>
              ) : null}
              {result.perQuestion?.length ? (
                <GhostButton onClick={() => setShowDetails((s) => !s)}>
                  {showDetails ? t("detailsHide") : t("detailsShow")}
                </GhostButton>
              ) : null}
              {!passed || canRetry ? (
                <GhostButton disabled={pending} onClick={startNewAttempt}>
                  {t("tryAgain")}
                </GhostButton>
              ) : null}
              <BackLink
              href={{
                pathname: "/learn/[slug]",
                params: { slug: quiz.courseSlug },
              }}
            >
                {t("backToCourse")}
              </BackLink>
            </ActionRow>

            {showDetails && result.perQuestion?.length ? (
              <DetailList aria-label={t("detailsShow")}>
                {quiz.questions.map((question, qi) => {
                  const detail = resultByQuestion.get(question.id);
                  if (!detail) return null;
                  const given = answerText(question);
                  return (
                    <DetailItem key={question.id} $correct={detail.correct}>
                      <strong>
                        {qi + 1}. {question.text}
                      </strong>
                      <DetailMeta>
                        {detail.correct ? (
                          <Badge $tone="success">{t("answerCorrect")}</Badge>
                        ) : (
                          <Badge $tone="muted">{t("answerWrong")}</Badge>
                        )}
                        <span>
                          {t("pointsEarned", {
                            earned: detail.correct ? detail.points : 0,
                            total: detail.points,
                          })}
                        </span>
                      </DetailMeta>
                      <DetailAnswer>
                        {t("yourAnswer")}{" "}
                        <em>{given || t("noAnswer")}</em>
                      </DetailAnswer>
                    </DetailItem>
                  );
                })}
              </DetailList>
            ) : null}
            {passed && result.certificateSerial ? (
              <Muted style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
                {t("certificateHint")}
              </Muted>
            ) : null}
          </ResultCard>
        </Container>
      </Wrap>
    );
  }

  // Rückgabegarantie aktiv: eigener Sperr-Screen mit der Option, die
  // Garantie freiwillig zu beenden und die Prüfung sofort freizuschalten
  if (attemptState.blocked === "guarantee") {
    const untilLabel = attemptState.guaranteeUntil
      ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
          new Date(attemptState.guaranteeUntil)
        )
      : "…";
    return (
      <Wrap id="main">
        <Container>
          <Kicker>{quiz.courseTitle}</Kicker>
          <SectionTitle as="h1">
            {t("title", { title: quiz.title })}
          </SectionTitle>
          <FormAlert
            $tone="error"
            role="status"
            style={{ marginTop: "1.5rem", maxWidth: "560px" }}
          >
            {t("guaranteeBlocked", { date: untilLabel })}
          </FormAlert>
          <Muted style={{ marginTop: "1rem", maxWidth: "560px" }}>
            {t("guaranteeExplain")}
          </Muted>
          {waiveConfirm ? (
            <>
              <FormAlert
                $tone="error"
                role="alert"
                style={{ marginTop: "1rem", maxWidth: "560px" }}
              >
                {t("guaranteeWaiveWarning")}
              </FormAlert>
              <ActionRow style={{ justifyContent: "flex-start" }}>
                <PrimaryButton
                  type="button"
                  disabled={pending}
                  onClick={onWaiveGuarantee}
                >
                  {t("guaranteeWaiveConfirm")}
                </PrimaryButton>
                <GhostButton
                  type="button"
                  onClick={() => setWaiveConfirm(false)}
                >
                  {t("guaranteeWaiveCancel")}
                </GhostButton>
              </ActionRow>
            </>
          ) : (
            <ActionRow style={{ justifyContent: "flex-start" }}>
              <GhostButton
                type="button"
                onClick={() => setWaiveConfirm(true)}
              >
                {t("guaranteeWaive")}
              </GhostButton>
              <BackLink
                href={{
                  pathname: "/learn/[slug]",
                  params: { slug: quiz.courseSlug },
                }}
              >
                {t("backToCourse")}
              </BackLink>
            </ActionRow>
          )}
        </Container>
      </Wrap>
    );
  }

  if (attemptState.blocked) {
    const blockedMessage =
      attemptState.blocked === "already_passed"
        ? t("blockedAlreadyPassed")
        : attemptState.blocked === "not_eligible"
          ? t("notEligiblePage", {
              percent: attemptState.requiredWatchPercent ?? 0,
            })
          : attemptState.blocked === "attempts_exhausted"
          ? t("blockedExhausted")
          : t("blockedCooldown", {
              date: attemptState.nextAttemptAt
                ? new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(attemptState.nextAttemptAt))
                : "…",
            });
    return (
      <Wrap id="main">
        <Container>
          <Kicker>{quiz.courseTitle}</Kicker>
          <SectionTitle as="h1">
            {t("title", { title: quiz.title })}
          </SectionTitle>
          <FormAlert
            $tone="error"
            role="status"
            style={{ marginTop: "1.5rem", maxWidth: "560px" }}
          >
            {blockedMessage}
          </FormAlert>
          <ActionRow style={{ justifyContent: "flex-start" }}>
            <BackLink
              href={{
                pathname: "/learn/[slug]",
                params: { slug: quiz.courseSlug },
              }}
            >
              {t("backToCourse")}
            </BackLink>
          </ActionRow>
        </Container>
      </Wrap>
    );
  }

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{quiz.courseTitle}</Kicker>
        <SectionTitle as="h1">
          {t("title", { title: quiz.title })}
        </SectionTitle>
        <Muted>
          {t("passPercent", { percent: quiz.passPercent })}
          {attemptState.maxAttempts !== null
            ? ` · ${t("attemptsUsed", {
                used: attemptState.usedAttempts + 1,
                max: attemptState.maxAttempts,
              })}`
            : ""}
        </Muted>

        <StatusRow>
          {secondsLeft !== null ? (
            <TimerBadge
              $urgent={secondsLeft <= 60}
              role="timer"
              aria-label={t("timeLeft")}
            >
              ⏱ {formatDuration(secondsLeft)}
            </TimerBadge>
          ) : null}

          {/* Weltall-Ampel: zeigt dauerhaft, wie es um die Prüfung steht –
              nicht erst dann, wenn schon ein Verstoß passiert ist. */}
          <div role="status" aria-live="polite">
            <ExamSignal
              level={signalLevel}
              label={t(SIGNAL_LABELS[signalLevel])}
              detail={
                signalLevel === 0
                  ? t("signalStableDetail")
                  : t("signalRemaining", { left: MAX_TAB_LEAVES - leaves })
              }
            />
          </div>
        </StatusRow>

        <GuardedForm
          onSubmit={onSubmit}
          // Fragen/Antworten nicht kopierbar; Kontextmenü unterbunden
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {quiz.questions.map((question, qi) => (
            <QuestionCard key={question.id} as="fieldset">
              <QuestionMeta>
                {t("question", {
                  current: qi + 1,
                  total: quiz.questions.length,
                })}
                {" · "}
                {t("questionPoints", { points: question.points })}
              </QuestionMeta>
              <h2 id={`q-${question.id}`}>{question.text}</h2>
              {question.kind === "FREE_TEXT" ? (
                <FreeTextInput
                  aria-labelledby={`q-${question.id}`}
                  value={answers[question.id]?.[0] ?? ""}
                  maxLength={2000}
                  placeholder={t("freeTextPlaceholder")}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: [e.target.value],
                    }))
                  }
                />
              ) : (
                <div role="group" aria-labelledby={`q-${question.id}`}>
                  {question.options.map((option) => (
                    <OptionLabel key={option.id}>
                      <input
                        type={
                          question.kind === "SINGLE" ? "radio" : "checkbox"
                        }
                        name={question.id}
                        checked={(answers[question.id] ?? []).includes(
                          option.id
                        )}
                        onChange={() =>
                          toggle(
                            question.id,
                            option.id,
                            question.kind === "SINGLE"
                          )
                        }
                      />
                      {option.text}
                    </OptionLabel>
                  ))}
                </div>
              )}
            </QuestionCard>
          ))}

          {error ? (
            <FormAlert
              $tone="error"
              role="alert"
              style={{ marginTop: "1.25rem" }}
            >
              {error}
            </FormAlert>
          ) : null}

          <ActionRow style={{ justifyContent: "flex-start" }}>
            <PrimaryButton type="submit" disabled={pending}>
              {t("submit")}
            </PrimaryButton>
            <BackLink
              href={{
                pathname: "/learn/[slug]",
                params: { slug: quiz.courseSlug },
              }}
            >
              {t("backToCourse")}
            </BackLink>
          </ActionRow>
        </GuardedForm>

        {leaveWarning !== null ? (
          <LeaveOverlay role="alertdialog" aria-modal="true">
            <LeaveDialog $critical={signalLevel === 2}>
              <ExamSignal
                large
                level={signalLevel}
                label={t(SIGNAL_LABELS[signalLevel])}
                detail={t("signalRemaining", {
                  left: MAX_TAB_LEAVES - leaveWarning,
                })}
              />
              <h2>{t("leaveWarningTitle")}</h2>
              <p>
                {t("leaveWarningText", {
                  count: leaveWarning,
                  max: MAX_TAB_LEAVES,
                })}
              </p>
              <PrimaryButton
                type="button"
                onClick={() => setLeaveWarning(null)}
              >
                {t("leaveWarningContinue")}
              </PrimaryButton>
            </LeaveDialog>
          </LeaveOverlay>
        ) : null}
      </Container>
    </Wrap>
  );
}
