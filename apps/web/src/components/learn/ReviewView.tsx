"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled, { css } from "styled-components";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { reviewCard } from "@/app/actions/flashcard-actions";
import type { Flashcard } from "@/lib/services/flashcard-service";
import {
  Badge,
  Container,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ui/ProgressBar";

const Wrap = styled.main`
  padding: 4rem 0 3rem;
`;

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
`;

const CardStage = styled.div`
  position: relative;
  margin-top: 2rem;
  min-height: 380px;
`;

const CardShell = styled(motion.section)`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  padding: 1.75rem;
  max-width: 720px;

  h2 {
    font-size: clamp(1.1rem, 3vw, 1.45rem);
    line-height: 1.4;
    margin: 1rem 0 1.5rem;
  }
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;

  span.quiz {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const OptionList = styled.div`
  display: grid;
  gap: 0.6rem;
`;

const OptionButton = styled.button<{
  $state: "idle" | "selected" | "correct" | "wrong" | "missed";
}>`
  text-align: left;
  width: 100%;
  padding: 0.85rem 1rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgElevated};
  font-size: 0.95rem;
  line-height: 1.45;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 120ms ease;

  &:not(:disabled):hover {
    border-color: ${({ theme }) => theme.colors.accent};
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
  }

  ${({ $state, theme }) =>
    $state === "selected" &&
    css`
      border-color: ${theme.colors.accent};
      background: ${theme.colors.accentSoft};
    `}

  ${({ $state, theme }) =>
    $state === "correct" &&
    css`
      border-color: ${theme.colors.success};
      background: rgba(94, 234, 145, 0.08);
    `}

  ${({ $state, theme }) =>
    $state === "wrong" &&
    css`
      border-color: ${theme.colors.danger};
      background: rgba(255, 107, 107, 0.08);
    `}

  ${({ $state, theme }) =>
    $state === "missed" &&
    css`
      border-style: dashed;
      border-color: ${theme.colors.success};
    `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:not(:disabled):hover {
      transform: none;
    }
  }
`;

const RevealBox = styled(motion.div)`
  margin-top: 1.25rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding-top: 1.25rem;

  p.answer {
    font-size: 0.95rem;
    line-height: 1.55;
    padding: 0.85rem 1rem;
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ theme }) => theme.colors.success};
    background: rgba(94, 234, 145, 0.08);
  }
`;

const GradeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.1rem;
  align-items: center;
`;

const GradeHint = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.68rem;
  opacity: 0.75;
  margin-top: 0.15rem;
`;

const DoneCard = styled(motion.section)`
  margin-top: 2rem;
  max-width: 720px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background:
    radial-gradient(
      circle at 20% 0%,
      rgba(200, 255, 77, 0.08),
      transparent 55%
    ),
    ${({ theme }) => theme.colors.surface};
  padding: 2.5rem 1.75rem;
  text-align: center;

  .glyph {
    font-size: 2.5rem;
  }

  h2 {
    margin: 0.75rem 0 0.5rem;
    font-size: 1.5rem;
  }
`;

const StatRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin: 1.5rem 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;

    strong {
      font-family: ${({ theme }) => theme.fonts.mono};
      font-size: 1.4rem;
      color: ${({ theme }) => theme.colors.accent};
    }

    span {
      font-size: 0.8rem;
      color: ${({ theme }) => theme.colors.textMuted};
    }
  }
`;

const FreeTextInput = styled.textarea`
  width: 100%;
  min-height: 90px;
  resize: vertical;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.75rem 0.9rem;
  font-size: 0.92rem;
  line-height: 1.5;
  margin-bottom: 0.9rem;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

type Phase = "answer" | "reveal";

interface ReviewViewProps {
  cards: Flashcard[];
  dueCount: number;
  totalCards: number;
  nextDueAt: string | null;
}

/**
 * Karteikarten-Session (Spaced Repetition): Karten aus den eigenen
 * Prüfungen beantworten; falsch beantwortete Karten kommen ans Ende der
 * Session zurück, bis alles sitzt.
 */
export function ReviewView({
  cards,
  dueCount,
  totalCards,
  nextDueAt,
}: ReviewViewProps) {
  const t = useTranslations("review");
  const locale = useLocale();
  const reducedMotion = useReducedMotion();

  const [queue, setQueue] = useState(cards);
  const [phase, setPhase] = useState<Phase>("answer");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  const [knownCount, setKnownCount] = useState(0);
  const [freeText, setFreeText] = useState("");
  // Karten-Identität für die Wechsel-Animation (Karte kann erneut kommen)
  const [pass, setPass] = useState(0);

  const sessionTotal = cards.length;
  const card = queue[0] ?? null;
  const correctIds = useMemo(
    () =>
      new Set(
        (card?.options ?? []).filter((o) => o.correct).map((o) => o.id)
      ),
    [card]
  );

  function toggleOption(id: string) {
    if (!card || phase !== "answer") return;
    if (card.kind === "SINGLE") {
      checkAnswer(new Set([id]));
      return;
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function checkAnswer(chosen: Set<string>) {
    if (!card) return;
    const correct =
      chosen.size === correctIds.size &&
      [...chosen].every((id) => correctIds.has(id));
    setSelected(chosen);
    setWasCorrect(correct);
    setPhase("reveal");
    // Falsch: sofort als "Nochmal" werten – die Karte kommt gleich wieder
    if (!correct) void reviewCard({ questionId: card.questionId, grade: "again" });
  }

  function revealFreeText() {
    setWasCorrect(null);
    setPhase("reveal");
  }

  function advance(grade: "again" | "good" | "easy" | null) {
    if (!card) return;
    if (grade) void reviewCard({ questionId: card.questionId, grade });

    const again = grade === "again" || wasCorrect === false;
    setQueue((current) => {
      const rest = current.slice(1);
      // Nicht gewusste Karten ans Ende – die Session endet erst, wenn alles saß
      return again ? [...rest, card] : rest;
    });
    if (!again) {
      // in diesem Zweig ist die Karte immer "gewusst" (falsch → again-Zweig)
      setDoneCount((n) => n + 1);
      setKnownCount((n) => n + 1);
    }
    setPhase("answer");
    setSelected(new Set());
    setWasCorrect(null);
    setFreeText("");
    setPass((n) => n + 1);
  }

  function optionState(
    optionId: string
  ): "idle" | "selected" | "correct" | "wrong" | "missed" {
    if (phase === "answer") {
      return selected.has(optionId) ? "selected" : "idle";
    }
    const chosen = selected.has(optionId);
    const correct = correctIds.has(optionId);
    if (chosen && correct) return "correct";
    if (chosen && !correct) return "wrong";
    if (!chosen && correct) return "missed";
    return "idle";
  }

  const goodInterval = card && card.reps === 0 ? 1 : 3;

  return (
    <Wrap id="main">
      <Container>
        <Head>
          <div>
            <Kicker>{t("kicker")}</Kicker>
            <SectionTitle as="h1">{t("title")}</SectionTitle>
          </div>
          {card ? (
            <div style={{ minWidth: 220 }}>
              <Muted style={{ fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                {t("progress", {
                  done: Math.min(doneCount + 1, sessionTotal),
                  total: sessionTotal,
                })}
              </Muted>
              <ProgressBar
                percent={(doneCount / Math.max(1, sessionTotal)) * 100}
                label={t("title")}
              />
            </div>
          ) : null}
        </Head>

        {sessionTotal === 0 ? (
          <DoneCard
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="glyph" aria-hidden>
              ✦
            </span>
            <h2>{t("emptyTitle")}</h2>
            <Muted>
              {totalCards === 0
                ? t("emptyNoCards")
                : nextDueAt
                  ? t("emptyNextDue", {
                      date: new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(nextDueAt)),
                    })
                  : t("emptyAllDone")}
            </Muted>
            <div style={{ marginTop: "1.5rem" }}>
              <Link href="/my-learning">
                <GhostButton as="span">{t("backToLearning")}</GhostButton>
              </Link>
            </div>
          </DoneCard>
        ) : card ? (
          <CardStage>
            <AnimatePresence mode="wait">
              <CardShell
                key={`${card.questionId}-${pass}`}
                initial={
                  reducedMotion ? false : { opacity: 0, x: 40, rotate: 1.5 }
                }
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -40, rotate: -1.5 }
                }
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <MetaRow>
                  <Badge $tone="violet">{card.courseTitle}</Badge>
                  <span className="quiz">{card.quizTitle}</span>
                  {card.reps === 0 ? (
                    <Badge $tone="accent">{t("newCard")}</Badge>
                  ) : null}
                </MetaRow>
                <h2>{card.text}</h2>

                {card.kind === "FREE_TEXT" ? (
                  <div>
                    {phase === "answer" ? (
                      <>
                        <FreeTextInput
                          value={freeText}
                          onChange={(e) => setFreeText(e.target.value)}
                          placeholder={t("freeTextPlaceholder")}
                          aria-label={t("freeTextPlaceholder")}
                        />
                        <PrimaryButton type="button" onClick={revealFreeText}>
                          {t("showAnswer")}
                        </PrimaryButton>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <OptionList role="group" aria-label={t("optionsLabel")}>
                      {card.options.map((option) => (
                        <OptionButton
                          key={option.id}
                          type="button"
                          $state={optionState(option.id)}
                          disabled={phase === "reveal"}
                          aria-pressed={selected.has(option.id)}
                          onClick={() => toggleOption(option.id)}
                        >
                          {option.text}
                        </OptionButton>
                      ))}
                    </OptionList>
                    {card.kind === "MULTIPLE" && phase === "answer" ? (
                      <div style={{ marginTop: "1rem" }}>
                        <PrimaryButton
                          type="button"
                          disabled={selected.size === 0}
                          onClick={() => checkAnswer(selected)}
                        >
                          {t("check")}
                        </PrimaryButton>
                      </div>
                    ) : null}
                  </>
                )}

                {phase === "reveal" ? (
                  <RevealBox
                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {card.kind === "FREE_TEXT" ? (
                      <>
                        {freeText.trim() ? (
                          <Muted style={{ marginBottom: "0.6rem" }}>
                            {t("yourAnswer")}: {freeText}
                          </Muted>
                        ) : null}
                        <p className="answer">
                          {card.expectedAnswer || t("noExpectedAnswer")}
                        </p>
                        <GradeRow>
                          <GhostButton
                            type="button"
                            onClick={() => advance("again")}
                          >
                            {t("gradeAgain")}
                            <GradeHint>{t("gradeAgainHint")}</GradeHint>
                          </GhostButton>
                          <PrimaryButton
                            type="button"
                            onClick={() => advance("good")}
                          >
                            {t("gradeGood")}
                            <GradeHint>
                              {t("gradeDaysHint", { days: goodInterval })}
                            </GradeHint>
                          </PrimaryButton>
                          <GhostButton
                            type="button"
                            onClick={() => advance("easy")}
                          >
                            {t("gradeEasy")}
                          </GhostButton>
                        </GradeRow>
                      </>
                    ) : wasCorrect ? (
                      <>
                        <Badge $tone="success">{t("correct")}</Badge>
                        <GradeRow>
                          <PrimaryButton
                            type="button"
                            onClick={() => advance("good")}
                          >
                            {t("gradeGood")}
                            <GradeHint>
                              {t("gradeDaysHint", { days: goodInterval })}
                            </GradeHint>
                          </PrimaryButton>
                          <GhostButton
                            type="button"
                            onClick={() => advance("easy")}
                          >
                            {t("gradeEasy")}
                          </GhostButton>
                        </GradeRow>
                      </>
                    ) : (
                      <>
                        <Badge $tone="muted">{t("wrong")}</Badge>
                        <Muted style={{ margin: "0.6rem 0 0" }}>
                          {t("wrongHint")}
                        </Muted>
                        <GradeRow>
                          <PrimaryButton
                            type="button"
                            onClick={() => advance(null)}
                          >
                            {t("next")}
                          </PrimaryButton>
                        </GradeRow>
                      </>
                    )}
                  </RevealBox>
                ) : null}
              </CardShell>
            </AnimatePresence>
          </CardStage>
        ) : (
          <DoneCard
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="glyph" aria-hidden>
              🎉
            </span>
            <h2>{t("doneTitle")}</h2>
            <Muted>{t("doneText")}</Muted>
            <StatRow>
              <div>
                <strong>{doneCount}</strong>
                <span>{t("doneCards")}</span>
              </div>
              <div>
                <strong>
                  {Math.round((knownCount / Math.max(1, doneCount)) * 100)} %
                </strong>
                <span>{t("doneKnown")}</span>
              </div>
            </StatRow>
            <Link href="/my-learning">
              <PrimaryButton as="span">{t("backToLearning")}</PrimaryButton>
            </Link>
          </DoneCard>
        )}

        {sessionTotal > 0 && dueCount > sessionTotal ? (
          <Muted style={{ marginTop: "1rem", fontSize: "0.8rem" }}>
            {t("moreDue", { count: dueCount - sessionTotal })}
          </Muted>
        ) : null}
      </Container>
    </Wrap>
  );
}
