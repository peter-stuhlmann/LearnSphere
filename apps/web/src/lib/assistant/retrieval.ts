/**
 * Retrieval des Lernassistenten: Cosine-Similarity über die Kurs-Chunks.
 * Bewusst ohne Vektor-Datenbank – ein Kurs hat wenige hundert Chunks, die
 * Isolation ist damit eine einzige WHERE-Klausel (courseId) beim Laden.
 */

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

export interface RankOptions {
  topK?: number;
  /** Treffer unterhalb dieser Ähnlichkeit gelten als irrelevant */
  minScore?: number;
  /** Chunks der aktuell geöffneten Lektion bekommen einen Score-Bonus */
  currentLessonId?: string | null;
  lessonBonus?: number;
}

export function rankChunks<
  T extends { embedding: number[]; lessonId?: string | null },
>(
  queryEmbedding: number[],
  chunks: T[],
  { topK = 8, minScore = 0.25, currentLessonId = null, lessonBonus = 0.08 }: RankOptions
): (T & { score: number })[] {
  return chunks
    .map((chunk) => {
      const base = cosineSimilarity(queryEmbedding, chunk.embedding);
      const bonus =
        currentLessonId && chunk.lessonId === currentLessonId
          ? lessonBonus
          : 0;
      return { ...chunk, score: base + bonus };
    })
    .filter((chunk) => chunk.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
