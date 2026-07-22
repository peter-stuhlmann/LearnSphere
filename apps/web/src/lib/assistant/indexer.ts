import { db } from "@/lib/db";
import {
  buildKnowledgeChunks,
  diffKnowledgeChunks,
  EMBEDDING_MODEL,
  type KnowledgeChunkDraft,
} from "./chunking";
import { decodeEmbedding, encodeEmbedding } from "./embedding-codec";
import {
  buildSummaryPrompt,
  collectSummarySources,
  SUMMARY_MODEL,
  type SummarySource,
} from "./summaries";
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
        embedding: encodeEmbedding(embeddings[j]),
      })),
      skipDuplicates: true,
    });
  }

  if (toDelete.length > 0) {
    await db.knowledgeChunk.deleteMany({
      where: { courseId, contentHash: { in: toDelete } },
    });
  }

  await refreshSummaries(courseId, collectSummarySources(drafts));

  await db.knowledgeIndexState.upsert({
    where: { courseId },
    create: { courseId, indexedAt: new Date() },
    update: { indexedAt: new Date() },
  });
  chunkCache.delete(courseId);
}

/**
 * Landkarte auffrischen: nur Lektionen zusammenfassen, deren Inhalt sich
 * geändert hat (sourceHash), und verwaiste Einträge entfernen. Ohne diesen
 * Vergleich würde jede Inhaltsänderung irgendwo im Kurs alle Lektionen neu
 * zusammenfassen lassen – bei 50 Lektionen wären das 50 Modellaufrufe für
 * einen korrigierten Tippfehler.
 */
async function refreshSummaries(
  courseId: string,
  sources: SummarySource[]
): Promise<void> {
  const existing = await db.knowledgeSummary.findMany({
    where: { courseId },
    select: { id: true, lessonId: true, lang: true, sourceHash: true },
  });
  const existingByKey = new Map(
    existing.map((row) => [`${row.lang}::${row.lessonId}`, row])
  );

  for (const source of sources) {
    const key = `${source.lang}::${source.lessonId}`;
    const current = existingByKey.get(key);
    if (current?.sourceHash === source.sourceHash) continue;

    const text = await summarise(source, courseId);
    if (!text) continue;

    await db.knowledgeSummary.upsert({
      where: {
        courseId_lang_lessonId: {
          courseId,
          lang: source.lang,
          lessonId: source.lessonId,
        },
      },
      create: {
        courseId,
        kind: "LESSON",
        lang: source.lang,
        sectionId: source.sectionId,
        lessonId: source.lessonId,
        sectionTitle: source.sectionTitle,
        lessonTitle: source.lessonTitle,
        order: source.order,
        text,
        sourceHash: source.sourceHash,
      },
      update: {
        sectionTitle: source.sectionTitle,
        lessonTitle: source.lessonTitle,
        order: source.order,
        text,
        sourceHash: source.sourceHash,
      },
    });
  }

  // gelöschte Lektionen aus der Landkarte entfernen
  const live = new Set(sources.map((s) => `${s.lang}::${s.lessonId}`));
  const orphans = existing
    .filter((row) => !live.has(`${row.lang}::${row.lessonId}`))
    .map((row) => row.id);
  if (orphans.length > 0) {
    await db.knowledgeSummary.deleteMany({ where: { id: { in: orphans } } });
  }
}

/** Ein Modellaufruf je Lektion. Scheitert er, bleibt die Lektion vorerst ohne
 *  Zusammenfassung – der Assistent verliert Überblick, aber nichts geht kaputt. */
async function summarise(
  source: SummarySource,
  courseId: string
): Promise<string | null> {
  const prompt = buildSummaryPrompt(source);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`openai_${response.status}`);
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    void recordAiUsage({
      activity: "SUMMARY",
      model: SUMMARY_MODEL,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      // Kursinhalt ist hier der System-Anteil, es gibt keine Nutzereingabe
      systemChars: prompt.length,
      courseId,
    });
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("[assistant] Zusammenfassung fehlgeschlagen:", error);
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Chunk-Cache
 * ------------------------------------------------------------------ */

export interface CachedChunk {
  lessonId: string | null;
  sectionTitle: string;
  lessonTitle: string;
  text: string;
  embedding: Float32Array;
}

/**
 * Die Chunks eines Kurses samt Embeddings im Arbeitsspeicher halten.
 *
 * Ohne Cache wird vor jeder Frage der komplette Kurs aus der Datenbank
 * geladen – bei einem zehnstündigen Videokurs rund 4 MB. Das ist der
 * teuerste Teil einer Antwort, noch bevor das erste Token generiert wird.
 * Mit Cache zahlt nur die erste Frage je Kurs.
 *
 * Bewusst schlicht: ein Eintrag je Kurs und Sprache, verworfen bei
 * Neuindexierung und nach Ablauf. Bei mehreren Instanzen hat jede ihren
 * eigenen Cache – das ist unproblematisch, weil er nur beschleunigt und
 * die Neuindexierung ihn invalidiert.
 */
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_COURSES = 24;

const chunkCache = new Map<
  string,
  { at: number; byLang: Map<string, CachedChunk[]> }
>();

export async function loadCourseChunks(
  courseId: string,
  lang: string
): Promise<CachedChunk[]> {
  const entry = chunkCache.get(courseId);
  if (entry && Date.now() - entry.at < CACHE_TTL_MS) {
    const cached = entry.byLang.get(lang);
    if (cached) return cached;
  }

  const rows = await db.knowledgeChunk.findMany({
    where: { courseId, lang },
    select: {
      lessonId: true,
      sectionTitle: true,
      lessonTitle: true,
      text: true,
      embedding: true,
    },
  });
  const chunks: CachedChunk[] = rows.map((row) => ({
    lessonId: row.lessonId,
    sectionTitle: row.sectionTitle,
    lessonTitle: row.lessonTitle,
    text: row.text,
    embedding: decodeEmbedding(row.embedding),
  }));

  const fresh = entry && Date.now() - entry.at < CACHE_TTL_MS
    ? entry
    : { at: Date.now(), byLang: new Map<string, CachedChunk[]>() };
  fresh.byLang.set(lang, chunks);
  chunkCache.set(courseId, fresh);

  // ältesten Eintrag verwerfen, statt unbegrenzt zu wachsen
  if (chunkCache.size > CACHE_MAX_COURSES) {
    const oldest = [...chunkCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) chunkCache.delete(oldest[0]);
  }

  return chunks;
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
