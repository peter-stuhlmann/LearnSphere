"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import { deleteQuiz, saveQuiz } from "@/app/actions/course-actions";
import {
  Card,
  Container,
  DangerButton,
  GhostButton,
  Kicker,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { StepSlider } from "@/components/ui/StepSlider";
import { PercentSlider } from "@/components/ui/PercentSlider";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useUnsavedMarker } from "@/components/ui/UnsavedChangesGuard";
import { FormAlert } from "@/components/auth/AuthShell";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const FormStack = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 2rem;
  max-width: 780px;
`;

const QuestionCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const OptionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.7rem;

  > div {
    flex: 1;
  }
`;

const CorrectToggle = styled.label`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
  cursor: pointer;

  input {
    width: 18px;
    height: 18px;
    accent-color: ${({ theme }) => theme.colors.accent};
  }
`;

const RemoveButton = styled.button`
  color: ${({ theme }) => theme.colors.danger};
  font-size: 0.85rem;

  &:hover {
    text-decoration: underline;
  }
`;

const MoveButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.85rem;

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.text};
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  &:disabled {
    opacity: 0.35;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 1px;
  }
`;

const ActionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;

  > div:first-child {
    flex: 1;
  }
`;

/* Zahnrad öffnet die Experteneinstellungen im Modal */
const ExpertButton = styled.button`
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgElevated};
  color: ${({ theme }) => theme.colors.textMuted};
  transition: color 140ms ease, border-color 140ms ease;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  svg {
    width: 20px;
    height: 20px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

interface OptionDraft {
  text: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  text: string;
  kind: "SINGLE" | "MULTIPLE" | "FREE_TEXT";
  /** Gewichtung in der Bewertung (Standard 1) */
  points: number;
  options: OptionDraft[];
  expectedAnswer: string;
  aiGraded: boolean;
}

interface QuizDraft {
  title: string;
  passPercent: number;
  maxAttempts: number | null;
  attemptWindowHours: number | null;
  retakeAfterPass: boolean;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  timeLimitMinutes: number | null;
  questions: QuestionDraft[];
}

const NEW_QUESTION: QuestionDraft = {
  text: "",
  kind: "SINGLE",
  points: 1,
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ],
  expectedAnswer: "",
  aiGraded: false,
};

/** Was gerade zur Löschung bestätigt werden soll */
type ConfirmTarget =
  | { kind: "question"; qi: number }
  | { kind: "option"; qi: number; oi: number }
  | { kind: "quiz" }
  | null;

interface QuizEditorProps {
  courseId: string;
  courseTitle: string;
  sectionId: string | null;
  sectionTitle: string | null;
  quizId: string | null;
  initial: QuizDraft | null;
}

export function QuizEditor({
  courseId,
  courseTitle,
  sectionId,
  sectionTitle,
  quizId,
  initial,
}: QuizEditorProps) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Gespeicherter Stand bzw. leerer Neu-Entwurf – auch Basis für die
  // "ungespeicherte Änderungen"-Erkennung
  const baseline: QuizDraft = initial ?? {
    title: sectionTitle
      ? `${t("sectionQuiz")}: ${sectionTitle}`
      : `${t("finalExam")}: ${courseTitle}`,
    passPercent: 70,
    maxAttempts: null,
    attemptWindowHours: null,
    retakeAfterPass: true,
    shuffleQuestions: false,
    // Standard an: Antwort-Reihenfolge zu mischen ist fast immer erwünscht
    shuffleAnswers: true,
    timeLimitMinutes: null,
    questions: [structuredClone(NEW_QUESTION)],
  };
  const [draft, setDraft] = useState<QuizDraft>(baseline);
  useUnsavedMarker(JSON.stringify(draft) !== JSON.stringify(baseline));
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [expertOpen, setExpertOpen] = useState(false);

  function confirmDelete() {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "question") {
      const { qi } = confirmTarget;
      setDraft((d) => ({
        ...d,
        questions: d.questions.filter((_, i) => i !== qi),
      }));
    } else if (confirmTarget.kind === "option") {
      const { qi, oi } = confirmTarget;
      setDraft((d) => ({
        ...d,
        questions: d.questions.map((q, i) =>
          i === qi
            ? { ...q, options: q.options.filter((_, j) => j !== oi) }
            : q
        ),
      }));
    } else if (confirmTarget.kind === "quiz" && quizId) {
      startTransition(async () => {
        await deleteQuiz(quizId);
        router.push({
          pathname: "/creator/courses/[id]",
          params: { id: courseId },
        });
      });
    }
    setConfirmTarget(null);
  }

  /** Frage per Pfeil verschieben – die Reihenfolge wird mitgespeichert. */
  function moveQuestion(index: number, dir: -1 | 1) {
    setDraft((d) => {
      const target = index + dir;
      if (target < 0 || target >= d.questions.length) return d;
      const questions = [...d.questions];
      [questions[index], questions[target]] = [
        questions[target],
        questions[index],
      ];
      return { ...d, questions };
    });
  }

  /** Antwortoption innerhalb ihrer Frage verschieben. */
  function moveOption(qIndex: number, oIndex: number, dir: -1 | 1) {
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q, i) => {
        if (i !== qIndex) return q;
        const target = oIndex + dir;
        if (target < 0 || target >= q.options.length) return q;
        const options = [...q.options];
        [options[oIndex], options[target]] = [
          options[target],
          options[oIndex],
        ];
        return { ...q, options };
      }),
    }));
  }

  function patchQuestion(index: number, patch: Partial<QuestionDraft>) {
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q, i) =>
        i === index ? { ...q, ...patch } : q
      ),
    }));
  }

  function patchOption(
    qIndex: number,
    oIndex: number,
    patch: Partial<OptionDraft>
  ) {
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q, i) => {
        if (i !== qIndex) return q;
        let options = q.options.map((o, j) =>
          j === oIndex ? { ...o, ...patch } : o
        );
        // Bei Single-Choice bleibt genau eine Option richtig
        if (patch.isCorrect && q.kind === "SINGLE") {
          options = options.map((o, j) => ({ ...o, isCorrect: j === oIndex }));
        }
        return { ...q, options };
      }),
    }));
  }

  /**
   * Eigene, verständliche Validierung statt der nativen Browser-Tooltips
   * (das Formular steht auf noValidate). Liefert die erste Fehlermeldung.
   */
  function validateDraft(d: QuizDraft): string | null {
    if (d.title.trim().length < 3) return t("quizErrTitle");
    for (const [i, q] of d.questions.entries()) {
      const n = i + 1;
      if (!q.text.trim()) return t("quizErrQuestionText", { n });
      if (q.kind === "FREE_TEXT") {
        if (!q.expectedAnswer.trim()) return t("quizErrExpectedAnswer", { n });
        continue;
      }
      if (q.options.length < 2) return t("quizErrTwoOptions", { n });
      if (q.options.some((o) => !o.text.trim()))
        return t("quizErrOptionText", { n });
      if (!q.options.some((o) => o.isCorrect))
        return t("quizErrCorrectOption", { n });
    }
    return null;
  }

  /** Server-Fehlercodes → verständliche Meldung (Fallback: generisch) */
  function serverErrorMessage(code: string | undefined): string {
    switch (code) {
      case "quiz_needs_question":
        return t("quizErrNeedsQuestion");
      case "question_needs_two_options":
        return t("quizErrTwoOptions", { n: "?" });
      case "question_needs_correct_option":
        return t("quizErrCorrectOption", { n: "?" });
      case "question_needs_expected_answer":
        return t("quizErrExpectedAnswer", { n: "?" });
      default:
        return t("quizErrGeneric");
    }
  }

  function showError(message: string) {
    setError(message);
    // Alert steht über dem Formular – sichtbar machen
    window.scrollTo({ top: 0 });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const invalid = validateDraft(draft);
    if (invalid) {
      showError(invalid);
      return;
    }

    startTransition(async () => {
      const result = await saveQuiz({
        courseId,
        sectionId,
        quiz: {
          ...draft,
          passPercent: Number(draft.passPercent),
        },
      });
      if (!result.ok) {
        showError(
          result.error === "content_flagged"
            ? t("textFlagged", { reason: result.reason ?? "" })
            : serverErrorMessage(result.error)
        );
        return;
      }
      setNotice(t("courseSaved"));
      router.refresh();
    });
  }

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{sectionId ? t("sectionQuiz") : t("finalExam")}</Kicker>
        <SectionTitle as="h1">
          {sectionTitle ?? courseTitle}
        </SectionTitle>

        <FormStack onSubmit={onSubmit} noValidate>
          {notice ? (
            <FormAlert $tone="success" role="status">
              {notice}
            </FormAlert>
          ) : null}
          {error ? (
            <FormAlert $tone="error" role="alert">
              {error}
            </FormAlert>
          ) : null}

          <TitleRow>
            <Field
              label={t("quizTitle")}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
              minLength={3}
            />
            <ExpertButton
              type="button"
              aria-label={t("expertSettings")}
              title={t("expertSettings")}
              onClick={() => setExpertOpen(true)}
            >
              {/* Zahnrad mit echten Zähnen (Feather "settings", MIT) */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </ExpertButton>
          </TitleRow>

          <Modal
            open={expertOpen}
            title={t("expertSettings")}
            closeLabel={t("expertSettingsDone")}
            onClose={() => setExpertOpen(false)}
          >
            <PercentSlider
              label={t("passPercent")}
              value={draft.passPercent}
              onChange={(passPercent) => setDraft({ ...draft, passPercent })}
            />

            <h3 style={{ fontSize: "1.05rem", marginTop: "0.5rem" }}>
              {t("attemptPolicy")}
            </h3>
            <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
              {t("attemptPolicyHint")}
            </p>
            <StepSlider
              label={t("maxAttempts")}
              value={draft.maxAttempts}
              options={[
                { value: 1, label: "1" },
                { value: 2, label: "2" },
                { value: 3, label: "3" },
                { value: 4, label: "4" },
                { value: 5, label: "5" },
                { value: null, label: "∞", display: t("unlimited") },
              ]}
              onChange={(value) => setDraft({ ...draft, maxAttempts: value })}
            />
            <StepSlider
              label={t("attemptWindowHours")}
              value={draft.attemptWindowHours}
              options={[
                { value: null, label: "—", display: t("noWindow") },
                { value: 1, label: "1 h" },
                { value: 6, label: "6 h" },
                { value: 12, label: "12 h" },
                { value: 24, label: "24 h" },
                { value: 48, label: "48 h" },
                { value: 72, label: "72 h" },
                { value: 168, label: "7 d", display: t("oneWeek") },
              ]}
              onChange={(value) =>
                setDraft({ ...draft, attemptWindowHours: value })
              }
            />
            <StepSlider
              label={t("timeLimit")}
              value={draft.timeLimitMinutes}
              options={[
                { value: null, label: "∞", display: t("noTimeLimit") },
                { value: 5, label: "5" },
                { value: 10, label: "10" },
                { value: 15, label: "15" },
                { value: 20, label: "20" },
                { value: 30, label: "30" },
                { value: 45, label: "45" },
                { value: 60, label: "60", display: "60 min" },
                { value: 90, label: "90", display: "90 min" },
                { value: 120, label: "120", display: "120 min" },
                { value: 180, label: "180", display: "180 min" },
              ]}
              onChange={(value) =>
                setDraft({ ...draft, timeLimitMinutes: value })
              }
            />
            <CorrectToggle as="label">
              <input
                type="checkbox"
                checked={draft.retakeAfterPass}
                onChange={(e) =>
                  setDraft({ ...draft, retakeAfterPass: e.target.checked })
                }
              />
              {t("retakeAfterPass")}
            </CorrectToggle>

            <h3 style={{ fontSize: "1.05rem", marginTop: "0.5rem" }}>
              {t("questions")}
            </h3>
            <CorrectToggle as="label">
              <input
                type="checkbox"
                checked={draft.shuffleQuestions}
                onChange={(e) =>
                  setDraft({ ...draft, shuffleQuestions: e.target.checked })
                }
              />
              {t("shuffleQuestions")}
            </CorrectToggle>
            <CorrectToggle as="label">
              <input
                type="checkbox"
                checked={draft.shuffleAnswers}
                onChange={(e) =>
                  setDraft({ ...draft, shuffleAnswers: e.target.checked })
                }
              />
              {t("shuffleAnswers")}
            </CorrectToggle>
          </Modal>

          <h2 style={{ fontSize: "1.2rem" }}>{t("questions")}</h2>

          {draft.questions.map((question, qi) => (
            <QuestionCard key={qi} as="fieldset" style={{ border: "1px solid" }}>
              <Field
                label={`${t("questionText")} ${qi + 1}`}
                value={question.text}
                onChange={(e) => patchQuestion(qi, { text: e.target.value })}
                required
              />
              <div>
                <label
                  htmlFor={`kind-${qi}`}
                  style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem" }}
                >
                  {t("questionKind")}
                </label>
                <Select
                  id={`kind-${qi}`}
                  value={question.kind}
                  options={[
                    { value: "SINGLE", label: t("kindSingle") },
                    { value: "MULTIPLE", label: t("kindMultiple") },
                    { value: "FREE_TEXT", label: t("kindFreeText") },
                  ]}
                  onChange={(kind) =>
                    patchQuestion(qi, {
                      kind: kind as QuestionDraft["kind"],
                    })
                  }
                />
              </div>

              <Field
                label={t("questionPoints")}
                type="number"
                min={1}
                max={100}
                value={question.points}
                hint={t("questionPointsHint")}
                onChange={(e) =>
                  patchQuestion(qi, {
                    points: Math.min(
                      100,
                      Math.max(1, Math.round(Number(e.target.value) || 1))
                    ),
                  })
                }
              />

              {question.kind === "FREE_TEXT" ? (
                <>
                  <Field
                    label={t("expectedAnswer")}
                    value={question.expectedAnswer}
                    onChange={(e) =>
                      patchQuestion(qi, { expectedAnswer: e.target.value })
                    }
                    required
                  />
                  <CorrectToggle as="label">
                    <input
                      type="checkbox"
                      checked={question.aiGraded}
                      onChange={(e) =>
                        patchQuestion(qi, { aiGraded: e.target.checked })
                      }
                    />
                    {t("aiGradedToggle")}
                  </CorrectToggle>
                  <p style={{ fontSize: "0.8rem", opacity: 0.65 }}>
                    {t("aiGradedHint")}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    {t("options")}
                  </p>
                  {question.options.map((option, oi) => (
                    <OptionRow key={oi}>
                      <Field
                        label={`${t("optionText")} ${oi + 1}`}
                        value={option.text}
                        onChange={(e) =>
                          patchOption(qi, oi, { text: e.target.value })
                        }
                        required
                      />
                      <CorrectToggle>
                        <input
                          type={
                            question.kind === "SINGLE" ? "radio" : "checkbox"
                          }
                          name={`correct-${qi}`}
                          checked={option.isCorrect}
                          onChange={(e) =>
                            patchOption(qi, oi, { isCorrect: e.target.checked })
                          }
                        />
                        {t("isCorrect")}
                      </CorrectToggle>
                      <MoveButton
                        type="button"
                        aria-label={`${t("moveUp")}: ${t("optionText")} ${oi + 1}`}
                        disabled={oi === 0}
                        onClick={() => moveOption(qi, oi, -1)}
                      >
                        ↑
                      </MoveButton>
                      <MoveButton
                        type="button"
                        aria-label={`${t("moveDown")}: ${t("optionText")} ${oi + 1}`}
                        disabled={oi === question.options.length - 1}
                        onClick={() => moveOption(qi, oi, 1)}
                      >
                        ↓
                      </MoveButton>
                      {question.options.length > 2 ? (
                        <RemoveButton
                          type="button"
                          aria-label={t("deleteOptionTitle")}
                          onClick={() =>
                            setConfirmTarget({ kind: "option", qi, oi })
                          }
                        >
                          ✕
                        </RemoveButton>
                      ) : null}
                    </OptionRow>
                  ))}
                </>
              )}

              <ActionsRow>
                <MoveButton
                  type="button"
                  aria-label={`${t("moveUp")}: ${t("questionText")} ${qi + 1}`}
                  disabled={qi === 0}
                  onClick={() => moveQuestion(qi, -1)}
                >
                  ↑
                </MoveButton>
                <MoveButton
                  type="button"
                  aria-label={`${t("moveDown")}: ${t("questionText")} ${qi + 1}`}
                  disabled={qi === draft.questions.length - 1}
                  onClick={() => moveQuestion(qi, 1)}
                >
                  ↓
                </MoveButton>
                {question.kind !== "FREE_TEXT" ? (
                  <GhostButton
                    type="button"
                    onClick={() =>
                      patchQuestion(qi, {
                        options: [
                          ...question.options,
                          { text: "", isCorrect: false },
                        ],
                      })
                    }
                  >
                    + {t("addOption")}
                  </GhostButton>
                ) : null}
                {draft.questions.length > 1 ? (
                  <DangerButton
                    type="button"
                    onClick={() => setConfirmTarget({ kind: "question", qi })}
                  >
                    {t("deleteQuestion")}
                  </DangerButton>
                ) : null}
              </ActionsRow>
            </QuestionCard>
          ))}

          <ActionsRow>
            <GhostButton
              type="button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  questions: [...d.questions, structuredClone(NEW_QUESTION)],
                }))
              }
            >
              + {t("addQuestion")}
            </GhostButton>
          </ActionsRow>

          <ActionsRow>
            <PrimaryButton type="submit" disabled={pending}>
              {tc("save")}
            </PrimaryButton>
            <GhostButton
              type="button"
              onClick={() => router.push({
                        pathname: "/creator/courses/[id]",
                        params: { id: courseId },
                      })}
            >
              {tc("back")}
            </GhostButton>
            {quizId ? (
              <DangerButton
                type="button"
                disabled={pending}
                onClick={() => setConfirmTarget({ kind: "quiz" })}
              >
                {sectionId ? t("deleteSectionQuiz") : t("deleteFinalQuiz")}
              </DangerButton>
            ) : null}
          </ActionsRow>
        </FormStack>

        <ConfirmDialog
          open={confirmTarget !== null}
          title={
            confirmTarget?.kind === "option"
              ? t("deleteOptionTitle")
              : confirmTarget?.kind === "quiz"
                ? t("deleteQuizTitle")
                : t("deleteQuestionTitle")
          }
          message={
            confirmTarget?.kind === "option"
              ? t("deleteOptionMessage")
              : confirmTarget?.kind === "quiz"
                ? t("deleteConfirm")
                : t("deleteQuestionMessage")
          }
          confirmLabel={tc("delete")}
          cancelLabel={tc("cancel")}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      </Container>
    </Wrap>
  );
}
