import { createHash } from "node:crypto";
import { htmlToPlainText } from "@elearning/core/html-text";
import { splitIntoTtsSegments } from "@/lib/tts";

/**
 * Kurs-Memory des Lernassistenten: zerlegt einen Kurs in Wissens-Chunks mit
 * Fundstelle (Abschnitt/Lektion/Block) je Kurssprache. Pure Funktionen –
 * der Eingabetyp kennt strukturell keine Quiz-Daten, Prüfungsfragen können
 * also nie ins Memory gelangen.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small";
/** Zielgröße: groß genug für in sich verständliche Aussagen */
export const KNOWLEDGE_CHUNK_MAX_CHARS = 900;

export interface KnowledgeBlockInput {
  id: string;
  type: "VIDEO" | "AUDIO" | "IMAGE" | "FILE" | "TEXT" | "HTML";
  title: string | null;
  content: string | null;
  transcriptDe: string | null;
  transcriptEn: string | null;
  translations?: unknown;
}

export interface KnowledgeLessonInput {
  id: string;
  title: string;
  translations?: unknown;
  blocks: KnowledgeBlockInput[];
}

export interface KnowledgeSectionInput {
  id: string;
  title: string;
  order: number;
  translations?: unknown;
  lessons: KnowledgeLessonInput[];
}

export interface KnowledgeCourseInput {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  language: string;
  languages: string[];
  translations?: unknown;
  sections: KnowledgeSectionInput[];
}

export type KnowledgeSourceType =
  | "TEXT"
  | "TRANSCRIPT"
  | "IMAGE_CAPTION"
  | "COURSE_META";

export interface KnowledgeChunkDraft {
  sourceType: KnowledgeSourceType;
  lang: string;
  sectionId: string | null;
  lessonId: string | null;
  blockId: string | null;
  sectionTitle: string;
  lessonTitle: string;
  text: string;
  contentHash: string;
}

/** Übersetztes Feld mit Fallback auf die Basissprache. */
function translated(
  translations: unknown,
  lang: string,
  field: string,
  base: string | null
): string {
  const value = (
    translations as Record<string, Record<string, unknown>> | null | undefined
  )?.[lang]?.[field];
  return typeof value === "string" && value ? value : (base ?? "");
}

function chunkHash(sourceType: string, lang: string, text: string): string {
  return createHash("sha256")
    .update(`${EMBEDDING_MODEL}|${sourceType}|${lang}|${text}`)
    .digest("hex");
}

export function buildKnowledgeChunks(
  course: KnowledgeCourseInput
): KnowledgeChunkDraft[] {
  const chunks: KnowledgeChunkDraft[] = [];
  const seen = new Set<string>();

  const push = (
    draft: Omit<KnowledgeChunkDraft, "contentHash" | "text"> & { text: string }
  ) => {
    const text = draft.text.trim();
    if (!text) return;
    const contentHash = chunkHash(draft.sourceType, draft.lang, text);
    // identische Inhalte (gleiche Sprache) nur einmal einbetten
    if (seen.has(contentHash)) return;
    seen.add(contentHash);
    chunks.push({ ...draft, text, contentHash });
  };

  for (const lang of course.languages) {
    const isBase = lang === course.language;

    // Kurs-Meta: Beschreibung + Untertitel
    const description = htmlToPlainText(
      isBase
        ? (course.description ?? "")
        : translated(course.translations, lang, "description", course.description)
    );
    const subtitle = isBase
      ? (course.subtitle ?? "")
      : translated(course.translations, lang, "subtitle", course.subtitle);
    push({
      sourceType: "COURSE_META",
      lang,
      sectionId: null,
      lessonId: null,
      blockId: null,
      sectionTitle: "",
      lessonTitle: "",
      text: [course.title, subtitle, description].filter(Boolean).join("\n"),
    });

    for (const section of [...course.sections].sort(
      (a, b) => a.order - b.order
    )) {
      const sectionTitle = isBase
        ? section.title
        : translated(section.translations, lang, "title", section.title);

      for (const lesson of section.lessons) {
        const lessonTitle = isBase
          ? lesson.title
          : translated(lesson.translations, lang, "title", lesson.title);
        const where = { sectionId: section.id, lessonId: lesson.id };
        /** Kontextzeile verbessert das Retrieval deutlich */
        const prefix = `${sectionTitle} · ${lessonTitle}\n`;

        for (const block of lesson.blocks) {
          if (block.type === "TEXT") {
            const html = isBase
              ? (block.content ?? "")
              : translated(block.translations, lang, "content", block.content);
            for (const segment of splitIntoTtsSegments(
              htmlToPlainText(html),
              KNOWLEDGE_CHUNK_MAX_CHARS
            )) {
              push({
                sourceType: "TEXT",
                lang,
                ...where,
                blockId: block.id,
                sectionTitle,
                lessonTitle,
                text: prefix + segment,
              });
            }
          }

          if (block.type === "VIDEO" || block.type === "AUDIO") {
            const transcript =
              lang === "en" ? block.transcriptEn : block.transcriptDe;
            for (const segment of splitIntoTtsSegments(
              (transcript ?? "").trim(),
              KNOWLEDGE_CHUNK_MAX_CHARS
            )) {
              push({
                sourceType: "TRANSCRIPT",
                lang,
                ...where,
                blockId: block.id,
                sectionTitle,
                lessonTitle,
                text: prefix + segment,
              });
            }
          }

          if (block.type === "IMAGE") {
            const caption = isBase
              ? (block.title ?? "")
              : translated(block.translations, lang, "title", block.title);
            push({
              sourceType: "IMAGE_CAPTION",
              lang,
              ...where,
              blockId: block.id,
              sectionTitle,
              lessonTitle,
              text: caption ? `${prefix}Abbildung: ${caption}` : "",
            });
          }
        }
      }
    }
  }

  return chunks;
}

/** Inkrementelles Update: nur Neues einbetten, Verwaistes entfernen. */
export function diffKnowledgeChunks(
  existingHashes: string[],
  drafts: KnowledgeChunkDraft[]
): { toCreate: KnowledgeChunkDraft[]; toDelete: string[] } {
  const draftHashes = new Set(drafts.map((d) => d.contentHash));
  const existing = new Set(existingHashes);
  return {
    toCreate: drafts.filter((d) => !existing.has(d.contentHash)),
    toDelete: existingHashes.filter((hash) => !draftHashes.has(hash)),
  };
}
