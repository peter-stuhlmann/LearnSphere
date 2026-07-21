"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import {
  deleteSelfTestQuestion,
  listSelfTestQuestions,
  regenerateSelfTest,
  type SelfTestQuestionDto,
} from "@/app/actions/self-test-actions";
import { Modal } from "@/components/ui/Modal";
import { GhostButton, Muted } from "@/components/ui/primitives";
import { IconButton } from "./CourseEditor";

/**
 * Creator-Verwaltung der KI-Selbsttests einer Lektion: Fragen je Sprache
 * einsehen, einzelne löschen oder komplett neu generieren lassen.
 */

const LangHead = styled.p`
  margin: 1rem 0 0.5rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const QuestionRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.6rem 0.8rem;
  margin-bottom: 0.4rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};

  p {
    flex: 1;
    font-size: 0.88rem;
  }
`;

const ErrorText = styled.p`
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.danger};
`;

export function SelfTestManager({
  lessonId,
  lessonTitle,
  languages,
  open,
  onClose,
}: {
  lessonId: string;
  lessonTitle: string;
  /** Kurssprachen, Basissprache zuerst */
  languages: string[];
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [byLang, setByLang] = useState<Record<string, SelfTestQuestionDto[]>>(
    {}
  );
  const [loaded, setLoaded] = useState(false);
  const [busyLang, setBusyLang] = useState<string | null>(null);
  const [error, setError] = useState(false);

  /* Die Verwaltung wird je Lektion frisch gemountet (key=lessonId im
     Aufrufer) – der Effect lädt daher genau einmal, Zustand startet leer. */
  useEffect(() => {
    let cancelled = false;
    listSelfTestQuestions(lessonId).then((result) => {
      if (cancelled) return;
      setByLang(result.ok ? (result.byLang ?? {}) : {});
      setLoaded(true);
      setError(!result.ok);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function remove(questionId: string, lang: string) {
    setError(false);
    const result = await deleteSelfTestQuestion(questionId);
    if (result.ok) {
      setByLang((prev) => ({
        ...prev,
        [lang]: (prev[lang] ?? []).filter((q) => q.id !== questionId),
      }));
    } else {
      setError(true);
    }
  }

  async function regenerate(lang: string) {
    setError(false);
    setBusyLang(lang);
    const result = await regenerateSelfTest({ lessonId, lang });
    setBusyLang(null);
    if (result.ok && result.questions) {
      setByLang((prev) => ({ ...prev, [lang]: result.questions ?? [] }));
    } else {
      setError(true);
    }
  }

  return (
    <Modal
      open={open}
      title={`${t("selfTestManageTitle")} · ${lessonTitle}`}
      closeLabel={tc("close")}
      onClose={onClose}
    >
      <Muted style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>
        {t("selfTestManageIntro")}
      </Muted>

      {loaded
        ? languages.map((lang) => {
            const questions = byLang[lang] ?? [];
            return (
              <div key={lang}>
                <LangHead>{lang.toUpperCase()}</LangHead>
                {questions.length === 0 ? (
                  <Muted style={{ fontSize: "0.82rem" }}>
                    {t("selfTestNoQuestions")}
                  </Muted>
                ) : (
                  questions.map((question) => (
                    <QuestionRow key={question.id}>
                      <p>{question.prompt}</p>
                      <IconButton
                        aria-label={`${t("selfTestDeleteQuestion")}: ${question.prompt.slice(0, 40)}`}
                        onClick={() => remove(question.id, lang)}
                      >
                        ✕
                      </IconButton>
                    </QuestionRow>
                  ))
                )}
                <GhostButton
                  type="button"
                  disabled={busyLang !== null}
                  onClick={() => regenerate(lang)}
                  style={{ marginTop: "0.4rem" }}
                >
                  {busyLang === lang
                    ? t("selfTestRegenerating")
                    : `✦ ${t("selfTestRegenerate")}`}
                </GhostButton>
              </div>
            );
          })
        : null}

      {error ? (
        <ErrorText role="alert">{t("selfTestManageError")}</ErrorText>
      ) : null}
    </Modal>
  );
}
