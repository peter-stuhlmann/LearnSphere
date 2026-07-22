import { createHash } from "node:crypto";

/**
 * Landkarte des Kurses: je Lektion eine Zusammenfassung.
 *
 * Warum überhaupt? Bei einem zehnstündigen Videokurs umfasst das Transkript
 * gut eine halbe Million Zeichen. Den ganzen Kurs mitzuschicken sprengt
 * jedes Kontextfenster, und reines Retrieval zeigt dem Modell immer nur
 * einen Ausschnitt von ein bis zwei Prozent. Der Assistent kann dann nicht
 * wissen, was sonst noch im Kurs steht – und erst recht keine Zusammenhänge
 * zwischen Abschnitt 2 und Abschnitt 6 herstellen.
 *
 * Die Zusammenfassungen lösen genau das: Sie sind klein genug, um bei JEDER
 * Frage vollständig mitzugehen, und geben dem Modell den Überblick. Die
 * Details holt weiterhin das Retrieval.
 *
 * Erzeugt werden sie beim Indexieren, also einmal je Inhaltsänderung – nicht
 * pro Frage. Der sourceHash sorgt dafür, dass unveränderte Lektionen nicht
 * erneut zusammengefasst werden.
 *
 * Abschnitte bekommen keine eigene Zusammenfassung: Ihre Überschrift plus
 * die Zusammenfassungen ihrer Lektionen sagen dasselbe, und jeder weitere
 * Modellaufruf kostet Geld.
 *
 * Dieses Modul ist rein – der Modellaufruf liegt im Indexer.
 */

export const SUMMARY_MODEL = "gpt-4o-mini";

/** Zielgröße einer Lektionszusammenfassung in Zeichen. */
export const LESSON_SUMMARY_CHARS = 600;

/**
 * So viel Quelltext je Lektion geht in die Zusammenfassung. Ein einstündiges
 * Video hat ~55.000 Zeichen Transkript; darüber hinaus liefert mehr Text
 * kaum bessere Zusammenfassungen, kostet aber linear mehr.
 */
export const SUMMARY_SOURCE_MAX_CHARS = 24_000;

/**
 * Obergrenze der gesamten Landkarte im Prompt. Bei ~600 Zeichen je Lektion
 * reicht das für rund 60 Lektionen – mehr als ein zehnstündiger Kurs hat.
 * Größere Kurse werden gekürzt, statt das Budget zu sprengen.
 */
export const MAP_MAX_CHARS = 40_000;

export interface SummarySource {
  lang: string;
  sectionId: string;
  lessonId: string;
  sectionTitle: string;
  lessonTitle: string;
  /** Position im Kurs – bestimmt die Reihenfolge in der Landkarte */
  order: number;
  /** Quelltext, aus dem zusammengefasst wird */
  text: string;
  sourceHash: string;
}

export function summaryHash(model: string, text: string): string {
  return createHash("sha256").update(`${model}|${text}`).digest("hex");
}

/** Minimalform eines Chunks, wie ihn buildKnowledgeChunks liefert. */
export interface SummarySourceChunk {
  lang: string;
  sectionId: string | null;
  lessonId: string | null;
  sectionTitle: string;
  lessonTitle: string;
  text: string;
}

/**
 * Fasst die Chunks je Lektion und Sprache zu einer Quelle zusammen.
 *
 * Die Reihenfolge des ersten Auftretens ist die Kursreihenfolge – die
 * Chunks kommen bereits nach Abschnitt und Lektion sortiert. Sie wird als
 * `order` festgehalten, denn nur so weiß der Assistent später, was im Kurs
 * wann kommt.
 */
export function collectSummarySources(
  chunks: SummarySourceChunk[],
  maxSourceChars = SUMMARY_SOURCE_MAX_CHARS
): SummarySource[] {
  const byLesson = new Map<string, SummarySource & { parts: string[] }>();
  const orderByLesson = new Map<string, number>();

  for (const chunk of chunks) {
    if (!chunk.lessonId) continue; // Kurs-Meta hat keine Lektion
    if (!orderByLesson.has(chunk.lessonId)) {
      orderByLesson.set(chunk.lessonId, orderByLesson.size);
    }
    const key = `${chunk.lang}::${chunk.lessonId}`;
    const existing = byLesson.get(key);
    if (existing) {
      existing.parts.push(chunk.text);
      continue;
    }
    byLesson.set(key, {
      lang: chunk.lang,
      sectionId: chunk.sectionId ?? "",
      lessonId: chunk.lessonId,
      sectionTitle: chunk.sectionTitle,
      lessonTitle: chunk.lessonTitle,
      order: orderByLesson.get(chunk.lessonId)!,
      text: "",
      sourceHash: "",
      parts: [chunk.text],
    });
  }

  return [...byLesson.values()].map(({ parts, ...source }) => {
    const text = parts.join("\n\n").slice(0, maxSourceChars);
    return { ...source, text, sourceHash: summaryHash(SUMMARY_MODEL, text) };
  });
}

/**
 * Auftrag an das Modell. Bewusst eng geführt: Es soll verdichten, was
 * dasteht, und nichts hinzuerfinden – die Landkarte gilt dem Assistenten
 * später als Kursinhalt, ein halluziniertes Detail wäre also eine falsche
 * Aussage über den Kurs.
 */
export function buildSummaryPrompt(source: SummarySource): string {
  return `Summarise the lesson "${source.lessonTitle}" (section "${source.sectionTitle}") of an online course for a course index.

Rules:
- Around ${LESSON_SUMMARY_CHARS} characters, plain prose, no headings, no bullet points.
- Name the concrete topics, terms, names and examples that appear. This summary is used to decide which lesson answers a question, so specifics matter far more than praise.
- Summarise ONLY what the material below says. Add nothing, and do not speculate about what the lesson might also contain.
- Write in the same language as the material.
- Output the summary text only, nothing else.

MATERIAL:
${source.text}`;
}

export interface SummaryRow {
  sectionTitle: string;
  lessonTitle: string;
  order: number;
  text: string;
}

/**
 * Die Landkarte, wie sie in den Systemprompt geht: in Kursreihenfolge,
 * Lektionen unter der Überschrift ihres Abschnitts.
 */
export function buildCourseMap(
  rows: SummaryRow[],
  maxChars = MAP_MAX_CHARS
): string {
  const sorted = [...rows].sort((a, b) => a.order - b.order);
  const lines: string[] = [];
  let currentSection: string | null = null;
  let used = 0;
  let skipped = 0;

  for (const row of sorted) {
    const heading =
      row.sectionTitle && row.sectionTitle !== currentSection
        ? `## ${row.sectionTitle}\n`
        : "";
    const line = `${heading}### ${row.lessonTitle}\n${row.text}`;
    if (used + line.length > maxChars) {
      skipped += 1;
      continue;
    }
    // Überschrift erst merken, wenn die Lektion auch wirklich passt
    if (heading) currentSection = row.sectionTitle;
    lines.push(line);
    used += line.length;
  }

  if (skipped > 0) {
    /* Ehrlich bleiben: Das Modell muss wissen, dass die Landkarte
       unvollständig ist – sonst behauptet es Vollständigkeit. */
    lines.push(
      `(${skipped} weitere Lektionen passen nicht in diese Übersicht. Sie existieren, ihr Inhalt ist hier aber nicht zusammengefasst.)`
    );
  }

  return lines.join("\n\n");
}
