"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildChapterPrompt,
  CHAPTER_MODEL,
  parseChapterResponse,
  type Chapter,
} from "@elearning/core/chapters";
import {
  buildFieldPrompt,
  buildImprovePrompt,
  COPILOT_FIELDS,
  COPILOT_MAX_TOKENS,
  COPILOT_MIN_CHARS,
  COPILOT_MODEL,
  IMPROVE_MAX_CHARS,
  IMPROVE_MIN_CHARS,
  paragraphsToHtml,
  parseFieldResponse,
  parseImproveResponse,
  type CopilotField,
} from "@/lib/copilot";
import { lessonStudyText } from "@elearning/core/self-test";
import { htmlToPlainText } from "@elearning/core/html-text";
import { sanitizeRichText } from "@/lib/sanitize";
import { recordAiUsage } from "@/lib/ai-usage-server";
import type { ActionResult } from "./auth-actions";

/**
 * KI-Werkzeuge für Creator (Copilot): Vorschläge aus vorhandenen Inhalten.
 * Alle Aktionen sind hinter OPENAI_API_KEY + Rate-Limit; ohne Key liefern
 * sie sauber "unavailable" (Feature-Gate wie bei Transkription/Assistent).
 */

export interface ChapterSuggestionResult extends ActionResult {
  chapters?: Chapter[];
}

/** Kapitelmarker aus dem Transkript eines Video-/Audio-Blocks vorschlagen. */
export async function suggestChapters(input: {
  transcript: string;
  durationSeconds: number;
  language: string;
}): Promise<ChapterSuggestionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: "unavailable" };
  if (
    !(await checkRateLimit(`chapters:${session.user.id}`, {
      limit: 15,
      windowMs: 60 * 60_000,
    }))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const transcript = htmlToPlainText(input.transcript).trim();
  if (transcript.length < 200) {
    return { ok: false, error: "transcript_too_short" };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAPTER_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: buildChapterPrompt({
              transcript,
              durationSeconds: Math.max(0, Math.floor(input.durationSeconds)),
              language: input.language === "en" ? "en" : "de",
            }),
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false, error: "generation_failed" };
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    void recordAiUsage({
      activity: "CHAPTERS",
      model: CHAPTER_MODEL,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      // System = Prompt-Gerüst, User = das Transkript
      systemChars: 600,
      userChars: transcript.length,
      userId: session.user.id,
    });
    const chapters = parseChapterResponse(
      data.choices?.[0]?.message?.content ?? "",
      input.durationSeconds
    );
    if (chapters.length === 0) return { ok: false, error: "generation_failed" };
    return { ok: true, chapters };
  } catch (err) {
    console.error("[copilot] Kapitel-Vorschlag fehlgeschlagen:", err);
    return { ok: false, error: "generation_failed" };
  }
}

export interface CourseFieldResult extends ActionResult {
  /** title/subtitle: String; tags: Array; description: HTML-String */
  value?: string | string[];
}

/**
 * EIN Kurs-Metafeld vorschlagen (Titel, Untertitel, Beschreibung ODER Tags)
 * – gezielter Einzel-Call statt teurem Rundumschlag. Nur für den Creator.
 */
export async function suggestCourseField(input: {
  courseId: string;
  field: CopilotField;
}): Promise<CourseFieldResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: "unavailable" };
  if (!COPILOT_FIELDS.includes(input.field)) {
    return { ok: false, error: "invalid_request" };
  }

  const course = await db.course.findUnique({
    where: { id: input.courseId },
    select: {
      id: true,
      title: true,
      language: true,
      creatorId: true,
      sections: {
        orderBy: { order: "asc" },
        select: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              blocks: {
                orderBy: { order: "asc" },
                select: {
                  type: true,
                  content: true,
                  transcriptDe: true,
                  transcriptEn: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!course || course.creatorId !== session.user.id) {
    return { ok: false, error: "not_found" };
  }

  if (
    !(await checkRateLimit(`copilot:${session.user.id}`, {
      limit: 20,
      windowMs: 60 * 60_000,
    }))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const studyText = course.sections
    .flatMap((section) => section.lessons)
    .map((lesson) => lessonStudyText(lesson.blocks, course.language))
    .filter(Boolean)
    .join("\n\n");
  if (studyText.length < COPILOT_MIN_CHARS) {
    return { ok: false, error: "not_enough_content" };
  }

  try {
    const prompt = buildFieldPrompt(input.field, {
      courseTitle: course.title,
      studyText,
      lang: course.language,
    });
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: COPILOT_MODEL,
        temperature: 0.5,
        max_tokens: COPILOT_MAX_TOKENS[input.field],
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return { ok: false, error: "generation_failed" };
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    void recordAiUsage({
      activity: "COPILOT",
      model: COPILOT_MODEL,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      systemChars: 400,
      userChars: studyText.length,
      userId: session.user.id,
      courseId: course.id,
    });
    const value = parseFieldResponse(
      input.field,
      data.choices?.[0]?.message?.content ?? ""
    );
    if (value === null) return { ok: false, error: "generation_failed" };
    // Beschreibung kommt als Absatz-Array → sicheres <p>-HTML für den Editor
    return {
      ok: true,
      value:
        input.field === "description" && Array.isArray(value)
          ? paragraphsToHtml(value)
          : value,
    };
  } catch (err) {
    console.error("[copilot] Feld-Vorschlag fehlgeschlagen:", err);
    return { ok: false, error: "generation_failed" };
  }
}

export interface ImproveTextResult extends ActionResult {
  value?: string;
}

/**
 * Markierten Text (Bubble-Menü der Beschreibung) stilistisch verbessern.
 * Kleiner, gezielter Call – Eingabe hart auf IMPROVE_MAX_CHARS gedeckelt.
 */
export async function improveCourseText(input: {
  text: string;
  lang: string;
}): Promise<ImproveTextResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: "unavailable" };

  const text = input.text.trim().slice(0, IMPROVE_MAX_CHARS);
  if (text.length < IMPROVE_MIN_CHARS) {
    return { ok: false, error: "invalid_request" };
  }

  if (
    !(await checkRateLimit(`copilot:${session.user.id}`, {
      limit: 20,
      windowMs: 60 * 60_000,
    }))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: COPILOT_MODEL,
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: buildImprovePrompt({ text, lang: input.lang }),
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false, error: "generation_failed" };
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    void recordAiUsage({
      activity: "COPILOT",
      model: COPILOT_MODEL,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      systemChars: 250,
      userChars: text.length,
      userId: session.user.id,
    });
    const value = parseImproveResponse(
      data.choices?.[0]?.message?.content ?? ""
    );
    if (!value) return { ok: false, error: "generation_failed" };
    // Sicherheitsnetz: KI-HTML durch dieselbe Allowlist wie beim Speichern
    return { ok: true, value: sanitizeRichText(value) };
  } catch (err) {
    console.error("[copilot] Text-Verbesserung fehlgeschlagen:", err);
    return { ok: false, error: "generation_failed" };
  }
}
