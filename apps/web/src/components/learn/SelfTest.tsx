"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import styled, { css, keyframes } from "styled-components";
import {
  fetchSelfTest,
  type SelfTestQuestionDto,
} from "@/app/actions/self-test-actions";
import { GhostButton, PrimaryButton } from "@/components/ui/primitives";
import { aiGeneratedProps } from "@/lib/ai-marking";

/**
 * "Teste dich": KI-generierte Übungsfragen zur Lektion. Zählt nirgendwo –
 * reines Lernwerkzeug. Fragen werden serverseitig je Inhaltsstand gecacht;
 * die Optionen mischen wir clientseitig bei jedem Durchlauf.
 */

const Card = styled.section`
  margin-top: 1.5rem;
  padding: 1.25rem 1.4rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  background:
    linear-gradient(${({ theme }) => theme.colors.bgElevated}, ${({ theme }) =>
      theme.colors.bgElevated}) padding-box,
    linear-gradient(120deg, ${({ theme }) => theme.colors.violet}, ${({
      theme,
    }) => theme.colors.accent}) border-box;
  border: 1.5px solid transparent;
`;

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 0.75rem;

  h3 {
    font-size: 1.1rem;

    span {
      color: ${({ theme }) => theme.colors.accent};
      margin-right: 0.4rem;
    }
  }

  p {
    font-size: 0.82rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
`;

const Loading = styled.p`
  margin-top: 0.9rem;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.textMuted};
  animation: ${pulse} 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const QuestionBlock = styled.fieldset`
  border: none;
  padding: 0;
  margin: 1.1rem 0 0;

  legend {
    font-weight: 600;
    font-size: 0.95rem;
    margin-bottom: 0.6rem;
  }
`;

const OptionLabel = styled.label<{
  $state: "idle" | "correct" | "wrong" | "missed";
}>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.9rem;
  margin-bottom: 0.4rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  input {
    accent-color: ${({ theme }) => theme.colors.accent};
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  input:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  ${({ $state, theme }) =>
    $state === "correct"
      ? css`
          border-color: ${theme.colors.success};
          background: ${theme.colors.successSoft};
        `
      : $state === "wrong"
        ? css`
            border-color: ${theme.colors.danger};
            background: ${theme.colors.dangerSoft};
          `
        : $state === "missed"
          ? css`
              border-color: ${theme.colors.success};
              border-style: dashed;
            `
          : ""}
`;

const Explanation = styled.p`
  margin: 0.35rem 0 0;
  padding: 0.6rem 0.9rem;
  border-left: 3px solid ${({ theme }) => theme.colors.violet};
  border-radius: 0 ${({ theme }) => theme.radii.sm}
    ${({ theme }) => theme.radii.sm} 0;
  background: ${({ theme }) => theme.colors.violetSoft};
  font-size: 0.84rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const FootRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.1rem;
`;

const Score = styled.p<{ $all: boolean }>`
  font-weight: 600;
  color: ${({ theme, $all }) =>
    $all ? theme.colors.success : theme.colors.text};
`;

const Hint = styled.p`
  margin-top: 0.9rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

/** deterministische Fisher-Yates-Mischung ohne Math.random-Abo pro Render */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Phase = "idle" | "loading" | "ready" | "hint";

export function SelfTest({
  lessonId,
  lang,
}: {
  lessonId: string;
  lang: string;
}) {
  const t = useTranslations("learn");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hintKey, setHintKey] = useState<string>("");
  const [questions, setQuestions] = useState<SelfTestQuestionDto[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [evaluated, setEvaluated] = useState(false);

  async function load() {
    setPhase("loading");
    const result = await fetchSelfTest({ lessonId, lang });
    if (result.ok && result.questions && result.questions.length > 0) {
      setQuestions(
        shuffled(result.questions).map((q) => ({
          ...q,
          options: shuffled(q.options),
        }))
      );
      setAnswers({});
      setEvaluated(false);
      setPhase("ready");
    } else {
      setHintKey(
        result.error === "not_enough_content"
          ? "selfTestNotEnough"
          : result.error === "rate_limited"
            ? "selfTestRateLimited"
            : result.error === "unavailable" || result.error === "disabled"
              ? "selfTestUnavailable"
              : "selfTestError"
      );
      setPhase("hint");
    }
  }

  function retry() {
    setQuestions((current) =>
      shuffled(current).map((q) => ({ ...q, options: shuffled(q.options) }))
    );
    setAnswers({});
    setEvaluated(false);
  }

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => answers[q.id] !== undefined);
  const correctCount = questions.filter(
    (q) => q.options[answers[q.id] ?? -1]?.correct
  ).length;

  return (
    // Fragen sind vollständig KI-generiert → maschinenlesbare Kennzeichnung
    <Card aria-label={t("selfTestTitle")} {...aiGeneratedProps}>
      <Head>
        <h3>
          <span aria-hidden>✦</span>
          {t("selfTestTitle")}
        </h3>
        <p>{t("selfTestIntro")}</p>
      </Head>

      {phase === "idle" ? (
        <FootRow>
          <PrimaryButton type="button" onClick={load}>
            {t("selfTestStart")}
          </PrimaryButton>
        </FootRow>
      ) : null}

      {phase === "loading" ? (
        <Loading role="status">✦ {t("selfTestLoading")}</Loading>
      ) : null}

      {phase === "hint" ? <Hint role="status">{t(hintKey)}</Hint> : null}

      {phase === "ready"
        ? questions.map((question, qIndex) => (
            <QuestionBlock key={question.id}>
              <legend>
                {qIndex + 1}. {question.prompt}
              </legend>
              {question.options.map((option, oIndex) => {
                const chosen = answers[question.id] === oIndex;
                const state = !evaluated
                  ? "idle"
                  : option.correct && chosen
                    ? "correct"
                    : option.correct
                      ? "missed"
                      : chosen
                        ? "wrong"
                        : "idle";
                return (
                  <OptionLabel key={oIndex} $state={state}>
                    <input
                      type="radio"
                      name={`selftest-${question.id}`}
                      checked={chosen}
                      disabled={evaluated}
                      onChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [question.id]: oIndex,
                        }))
                      }
                    />
                    {option.text}
                  </OptionLabel>
                );
              })}
              {evaluated ? (
                <Explanation>💡 {question.explanation}</Explanation>
              ) : null}
            </QuestionBlock>
          ))
        : null}

      {phase === "ready" ? (
        <FootRow>
          {!evaluated ? (
            <PrimaryButton
              type="button"
              disabled={!allAnswered}
              onClick={() => setEvaluated(true)}
            >
              {t("selfTestEvaluate")}
            </PrimaryButton>
          ) : (
            <>
              <Score role="status" $all={correctCount === questions.length}>
                {correctCount === questions.length ? "🎉 " : ""}
                {t("selfTestScore", {
                  correct: correctCount,
                  total: questions.length,
                })}
              </Score>
              <GhostButton type="button" onClick={retry}>
                {t("selfTestRetry")}
              </GhostButton>
            </>
          )}
        </FootRow>
      ) : null}
    </Card>
  );
}
