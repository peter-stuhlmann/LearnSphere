/**
 * Retrieval des Lernassistenten.
 *
 * Bewusst ohne Vektor-Datenbank: Jede Frage betrifft genau einen Kurs, die
 * Datenmenge je Abfrage ist damit durch die Kursgröße gedeckelt und wächst
 * auch bei zehntausend Kursen nicht. Ein ANN-Index über ein paar hundert
 * Vektoren wäre langsamer und ungenauer als die exakte Suche hier.
 *
 * Drei Dinge unterscheiden die Auswahl von einem simplen "nimm die Top 8":
 *
 * 1. Ein ZEICHENBUDGET statt einer festen Trefferzahl – acht Treffer sind
 *    bei einer kurzen Lektion viel und bei einem zehnstündigen Kurs nichts.
 * 2. VIELFALT über Lektionen: Ohne Deckel je Lektion kommen bei einer
 *    Vergleichsfrage alle Treffer aus derselben Lektion, und genau der
 *    Zusammenhang über Lektionen hinweg geht verloren.
 * 3. HYBRIDE Suche: Embeddings erfassen Bedeutung, aber Eigennamen, Zahlen
 *    und Fachbegriffe schlecht. Ein Wortabgleich daneben fängt das ab.
 */

export type Vector = Float32Array | number[];

export function cosineSimilarity(a: Vector, b: Vector): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * Suchbegriffe aus der Frage. Kurze Wörter tragen nichts zur Trennschärfe
 * bei ("der", "und", "wie") und würden fast überall treffen.
 */
export function queryTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((term) => term.length >= 4)
    ),
  ];
}

/** Anteil der Suchbegriffe, der im Text vorkommt (0..1). */
export function keywordScore(text: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const haystack = text.toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  return hits / terms.length;
}

export interface RankOptions {
  /** Gesamtbudget der ausgewählten Auszüge in Zeichen */
  charBudget?: number;
  /** Treffer unterhalb dieser Ähnlichkeit gelten als irrelevant */
  minScore?: number;
  /** Chunks der aktuell geöffneten Lektion bekommen einen Score-Bonus */
  currentLessonId?: string | null;
  lessonBonus?: number;
  /** Gewicht des Wortabgleichs neben der Vektorähnlichkeit */
  keywordWeight?: number;
  /** Höchstzahl Auszüge je Lektion in der ersten Runde */
  perLessonCap?: number;
  /** Suchbegriffe der Frage (aus queryTerms) */
  terms?: string[];
}

type Scored<T> = T & { score: number };

/**
 * Wählt die Auszüge aus, die dem Modell mitgegeben werden.
 *
 * Erste Runde: höchstens `perLessonCap` Auszüge je Lektion, nach Score –
 * das verteilt das Budget über den Kurs. Zweite Runde: ist Budget übrig,
 * wird mit den besten verbliebenen aufgefüllt. So gewinnt bei einer engen
 * Detailfrage am Ende doch die eine einschlägige Lektion, ohne dass eine
 * Vergleichsfrage vorher verhungert.
 */
export function rankChunks<
  T extends { embedding: Vector; lessonId?: string | null; text: string },
>(
  queryEmbedding: Vector,
  chunks: T[],
  {
    charBudget = 25_000,
    minScore = 0.25,
    currentLessonId = null,
    lessonBonus = 0.08,
    keywordWeight = 0.15,
    perLessonCap = 3,
    terms = [],
  }: RankOptions
): Scored<T>[] {
  const scored: Scored<T>[] = chunks
    .map((chunk) => {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      const keywords = keywordScore(chunk.text, terms) * keywordWeight;
      const bonus =
        currentLessonId && chunk.lessonId === currentLessonId ? lessonBonus : 0;
      return { ...chunk, score: similarity + keywords + bonus };
    })
    /* Die Schwelle gilt für die Vektorähnlichkeit inklusive Boni: Ein
       starker Wortabgleich soll einen mittelmäßigen Vektortreffer über die
       Schwelle heben können – genau dafür ist die hybride Suche da. */
    .filter((chunk) => chunk.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const selected: Scored<T>[] = [];
  const taken = new Set<Scored<T>>();
  const perLesson = new Map<string, number>();
  let used = 0;

  const take = (chunk: Scored<T>) => {
    selected.push(chunk);
    taken.add(chunk);
    used += chunk.text.length;
  };

  for (const chunk of scored) {
    if (used + chunk.text.length > charBudget) continue;
    const key = chunk.lessonId ?? "__course__";
    const count = perLesson.get(key) ?? 0;
    if (count >= perLessonCap) continue;
    perLesson.set(key, count + 1);
    take(chunk);
  }

  for (const chunk of scored) {
    if (taken.has(chunk)) continue;
    if (used + chunk.text.length > charBudget) continue;
    take(chunk);
  }

  return selected;
}
