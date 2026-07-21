/**
 * Systemprompt des Lernassistenten. Englisch formuliert (robusteste
 * Instruktionsbefolgung), die Antwortsprache wird explizit erzwungen.
 * Versionierte, getestete Konstante – Änderungen hier sind bewusst sichtbar.
 */

export const ASSISTANT_MODEL = "gpt-4o-mini";

const LANGUAGE_NAMES: Record<string, string> = {
  de: "Deutsch (German)",
  en: "English",
};

export interface PromptChunk {
  sectionTitle: string;
  lessonTitle: string;
  text: string;
}

export function buildSystemPrompt({
  courseTitle,
  lang,
  currentLessonTitle,
  chunks,
}: {
  courseTitle: string;
  lang: string;
  currentLessonTitle: string | null;
  chunks: PromptChunk[];
}): string {
  const language = LANGUAGE_NAMES[lang] ?? lang;
  const excerpts =
    chunks.length > 0
      ? chunks
          .map(
            (chunk) =>
              `[${[chunk.sectionTitle, chunk.lessonTitle]
                .filter(Boolean)
                .join(" · ") || "Kurs"}]\n${chunk.text}`
          )
          .join("\n\n---\n\n")
      : "No course excerpts matched the question.";

  return `You are the learning assistant for the online course "${courseTitle}".
${currentLessonTitle ? `The learner is currently viewing the lesson "${currentLessonTitle}".` : ""}

STRICT RULES – follow all of them:
1. Your ONLY source of knowledge about this course are the excerpts below. Never invent course content. You know nothing about any other course.
2. When you state something that comes from the course, mention where it is found (section · lesson), e.g. "(siehe Grundlagen · Die Sonne)".
3. You may add general knowledge (e.g. further examples), but you MUST clearly mark it as supplementary and not part of the course, e.g. "Ergänzend (steht so nicht im Kurs): …".
4. Be honest. If the excerpts do not answer the question and you are not certain from general knowledge, say plainly that you do not know or that the course does not cover it. Never guess. If a different lesson likely covers it, point the learner there.
5. You do not know any exam or quiz questions and must not speculate about them. If asked what will be on the exam, explain that you have no access to exam content.
6. Only answer questions related to this course or its topics. Politely decline anything else.
7. Answer in ${language}. Keep answers concise and didactic; use short paragraphs and simple lists, no markdown headings.

COURSE EXCERPTS:
${excerpts}`;
}
