import { db } from "@/lib/db";
import {
  buildKnowledgeChunks,
  diffKnowledgeChunks,
  EMBEDDING_MODEL,
  type KnowledgeChunkDraft,
} from "./chunking";
import { parseExtraLanguages } from "@elearning/core/course-i18n";
import { recordAiUsage } from "@/lib/ai-usage-server";

/**
 * Indexer des Kurs-Memory (IO-Schicht): hält die KnowledgeChunks eines
 * Kurses aktuell. Content-Actions markieren den Kurs als "stale"
 * (markKnowledgeStale); der Assistent ruft vor jeder Antwort
 * ensureCourseIndex auf und re-indexiert nur bei Bedarf – und dank
 * Hash-Diff nur die geänderten Chunks.
 */

/** Content-Action meldet: Kursinhalt hat sich geändert. */
export async function markKnowledgeStale(courseId: string): Promise<void> {
  await db.knowledgeIndexState
    .upsert({
      where: { courseId },
      create: { courseId, staleAt: new Date() },
      update: { staleAt: new Date() },
    })
    .catch(() => {
      // Staleness ist Best-Effort – der Lazy-Reindex prüft ohnehin erneut
    });
}

/** Ein Lauf je Kurs gleichzeitig (Single-Instance, wie das Rate-Limit). */
const running = new Map<string, Promise<void>>();

export async function ensureCourseIndex(courseId: string): Promise<void> {
  const existing = running.get(courseId);
  if (existing) return existing;

  const promise = reindexIfStale(courseId).finally(() =>
    running.delete(courseId)
  );
  running.set(courseId, promise);
  return promise;
}

async function reindexIfStale(courseId: string): Promise<void> {
  const state = await db.knowledgeIndexState.findUnique({
    where: { courseId },
  });
  if (
    state?.indexedAt &&
    (!state.staleAt || state.staleAt <= state.indexedAt)
  ) {
    return;
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      subtitle: true,
      description: true,
      language: true,
      extraLanguages: true,
      translations: true,
      // bewusst KEINE quizzes – Prüfungsinhalte sind strukturell außen vor
      sections: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
          translations: true,
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              translations: true,
              blocks: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  type: true,
                  title: true,
                  content: true,
                  transcriptDe: true,
                  transcriptEn: true,
                  translations: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!course) return;

  const drafts = buildKnowledgeChunks({
    ...course,
    languages: [
      course.language,
      ...parseExtraLanguages(course.extraLanguages, course.language),
    ],
  });

  const existingRows = await db.knowledgeChunk.findMany({
    where: { courseId },
    select: { contentHash: true },
  });
  const { toCreate, toDelete } = diffKnowledgeChunks(
    existingRows.map((row) => row.contentHash),
    drafts
  );

  // nur die neuen/geänderten Chunks einbetten (Batches à 100)
  for (let i = 0; i < toCreate.length; i += 100) {
    const batch = toCreate.slice(i, i + 100);
    const embeddings = await embedTexts(batch.map((chunk) => chunk.text));
    await db.knowledgeChunk.createMany({
      data: batch.map((chunk, j) => ({
        courseId,
        lessonId: chunk.lessonId,
        sectionId: chunk.sectionId,
        blockId: chunk.blockId,
        sourceType: chunk.sourceType,
        lang: chunk.lang,
        sectionTitle: chunk.sectionTitle,
        lessonTitle: chunk.lessonTitle,
        text: chunk.text,
        contentHash: chunk.contentHash,
        embedding: embeddings[j],
      })),
      skipDuplicates: true,
    });
  }

  if (toDelete.length > 0) {
    await db.knowledgeChunk.deleteMany({
      where: { courseId, contentHash: { in: toDelete } },
    });
  }

  await db.knowledgeIndexState.upsert({
    where: { courseId },
    create: { courseId, indexedAt: new Date() },
    update: { indexedAt: new Date() },
  });
}

/** Frage-Embedding für das Retrieval. */
export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!response.ok) {
    throw new Error(`openai_embeddings_${response.status}`);
  }
  const data = (await response.json()) as {
    data: { index: number; embedding: number[] }[];
    usage?: { prompt_tokens?: number };
  };
  // Kursinhalte sind hier der "User"-Anteil; System-Anteil gibt es nicht
  void recordAiUsage({
    activity: "EMBEDDING",
    model: EMBEDDING_MODEL,
    inputTokens: data.usage?.prompt_tokens,
    userChars: texts.reduce((sum, text) => sum + text.length, 0),
  });
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export type { KnowledgeChunkDraft };
