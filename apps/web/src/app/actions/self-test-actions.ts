"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordAiUsage } from "@/lib/ai-usage-server";
import {
  buildSelfTestPrompt,
  lessonStudyText,
  parseSelfTestOptions,
  parseSelfTestResponse,
  selfTestContentHash,
  SELF_TEST_MIN_CHARS,
  SELF_TEST_MODEL,
  type SelfTestOption,
} from "@elearning/core/self-test";
import type { ActionResult } from "./auth-actions";

/**
 * KI-Selbsttests: Fragen werden je (Lektion, Sprache, Inhaltsstand) einmal
 * generiert und für alle Lernenden gecacht. Der Creator kann sie je Kurs
 * abschalten und je Lektion einsehen, löschen und neu generieren lassen.
 */

export interface SelfTestQuestionDto {
  id: string;
  prompt: string;
  options: SelfTestOption[];
  explanation: string;
}

export interface SelfTestResult extends ActionResult {
  questions?: SelfTestQuestionDto[];
}

async function lessonWithCourse(lessonId: string) {
  return db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      blocks: {
        select: {
          type: true,
          content: true,
          transcriptDe: true,
          transcriptEn: true,
        },
        orderBy: { order: "asc" },
      },
      section: {
        select: {
          course: {
            select: { id: true, creatorId: true, selfTestsEnabled: true },
          },
        },
      },
    },
  });
}

function toDto(row: {
  id: string;
  prompt: string;
  options: unknown;
  explanation: string;
}): SelfTestQuestionDto | null {
  const options = parseSelfTestOptions(row.options);
  if (options.length === 0) return null;
  return {
    id: row.id,
    prompt: row.prompt,
    options,
    explanation: row.explanation,
  };
}

/** Fragen generieren und (je Sprache) als neuen Stand speichern. */
async function generateAndStore(
  lessonId: string,
  lang: string,
  studyText: string,
  contentHash: string,
  triggeredBy?: string | null
): Promise<SelfTestResult> {
  const prompt = buildSelfTestPrompt({ studyText, lang });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SELF_TEST_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return { ok: false, error: "generation_failed" };
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  // System = unsere Regeln im Prompt, User = der Lernstoff der Lektion
  const studyChars = Math.min(studyText.length, 24_000);
  void recordAiUsage({
    activity: "SELF_TEST",
    model: SELF_TEST_MODEL,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    systemChars: Math.max(0, prompt.length - studyChars),
    userChars: studyChars,
    userId: triggeredBy,
  });
  const questions = parseSelfTestResponse(
    data.choices?.[0]?.message?.content ?? ""
  );
  if (questions.length === 0) return { ok: false, error: "generation_failed" };

  // Alte Stände dieser Sprache ersetzen (Inhalt hat sich geändert)
  await db.$transaction([
    db.selfTestQuestion.deleteMany({ where: { lessonId, lang } }),
    db.selfTestQuestion.createMany({
      data: questions.map((q) => ({
        lessonId,
        lang,
        contentHash,
        prompt: q.prompt,
        options: q.options.map(({ text, correct }) => ({ text, correct })),
        explanation: q.explanation,
      })),
    }),
  ]);

  const rows = await db.selfTestQuestion.findMany({
    where: { lessonId, lang, contentHash },
    orderBy: { createdAt: "asc" },
  });
  return { ok: true, questions: rows.flatMap((r) => toDto(r) ?? []) };
}

/** Lernende: Fragen abrufen (bei Bedarf on-demand generieren). */
export async function fetchSelfTest(input: {
  lessonId: string;
  lang: string;
}): Promise<SelfTestResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const lesson = await lessonWithCourse(input.lessonId);
  if (!lesson) return { ok: false, error: "not_found" };
  const course = lesson.section.course;

  if (!course.selfTestsEnabled) return { ok: false, error: "disabled" };

  // Zugriff: eingeschrieben oder Creator
  if (course.creatorId !== session.user.id) {
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: { userId: session.user.id, courseId: course.id },
      },
      select: { id: true },
    });
    if (!enrollment) return { ok: false, error: "not_enrolled" };
  }

  const lang = input.lang === "en" ? "en" : "de";
  const studyText = lessonStudyText(lesson.blocks, lang);
  if (studyText.length < SELF_TEST_MIN_CHARS) {
    return { ok: false, error: "not_enough_content" };
  }
  const contentHash = selfTestContentHash(studyText, lang);

  const existing = await db.selfTestQuestion.findMany({
    where: { lessonId: lesson.id, lang, contentHash },
    orderBy: { createdAt: "asc" },
  });
  if (existing.length > 0) {
    return { ok: true, questions: existing.flatMap((r) => toDto(r) ?? []) };
  }

  if (!process.env.OPENAI_API_KEY) return { ok: false, error: "unavailable" };
  if (
    !(await checkRateLimit(`selftest:${session.user.id}`, {
      limit: 12,
      windowMs: 60 * 60_000,
    }))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  try {
    return await generateAndStore(
      lesson.id,
      lang,
      studyText,
      contentHash,
      session.user.id
    );
  } catch (err) {
    console.error("[selftest] Generierung fehlgeschlagen:", err);
    return { ok: false, error: "generation_failed" };
  }
}

/* ---------- Creator-Verwaltung ---------- */

async function requireLessonOwner(lessonId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const lesson = await lessonWithCourse(lessonId);
  if (!lesson || lesson.section.course.creatorId !== session.user.id) {
    return null;
  }
  return { lesson, userId: session.user.id };
}

export interface SelfTestOverview extends ActionResult {
  byLang?: Record<string, SelfTestQuestionDto[]>;
}

/** Creator: alle generierten Fragen einer Lektion (je Sprache). */
export async function listSelfTestQuestions(
  lessonId: string
): Promise<SelfTestOverview> {
  const owner = await requireLessonOwner(lessonId);
  if (!owner) return { ok: false, error: "unauthorized" };

  const rows = await db.selfTestQuestion.findMany({
    where: { lessonId },
    orderBy: [{ lang: "asc" }, { createdAt: "asc" }],
  });
  const byLang: Record<string, SelfTestQuestionDto[]> = {};
  for (const row of rows) {
    const dto = toDto(row);
    if (!dto) continue;
    (byLang[row.lang] ??= []).push(dto);
  }
  return { ok: true, byLang };
}

/** Creator: einzelne Frage löschen. */
export async function deleteSelfTestQuestion(
  questionId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const question = await db.selfTestQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      lesson: {
        select: {
          section: { select: { course: { select: { creatorId: true } } } },
        },
      },
    },
  });
  if (
    !question ||
    question.lesson.section.course.creatorId !== session.user.id
  ) {
    return { ok: false, error: "not_found" };
  }

  await db.selfTestQuestion.delete({ where: { id: questionId } });
  return { ok: true };
}

/** Creator: Fragen einer Sprache verwerfen und neu generieren. */
export async function regenerateSelfTest(input: {
  lessonId: string;
  lang: string;
}): Promise<SelfTestResult> {
  const owner = await requireLessonOwner(input.lessonId);
  if (!owner) return { ok: false, error: "unauthorized" };
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: "unavailable" };
  if (
    !(await checkRateLimit(`selftest:${owner.userId}`, {
      limit: 12,
      windowMs: 60 * 60_000,
    }))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const lang = input.lang === "en" ? "en" : "de";
  const studyText = lessonStudyText(owner.lesson.blocks, lang);
  if (studyText.length < SELF_TEST_MIN_CHARS) {
    return { ok: false, error: "not_enough_content" };
  }

  try {
    return await generateAndStore(
      owner.lesson.id,
      lang,
      studyText,
      selfTestContentHash(studyText, lang),
      owner.userId
    );
  } catch (err) {
    console.error("[selftest] Neu-Generierung fehlgeschlagen:", err);
    return { ok: false, error: "generation_failed" };
  }
}
