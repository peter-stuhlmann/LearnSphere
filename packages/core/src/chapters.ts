import { z } from "zod";

/**
 * Kapitelmarker für Video-/Audio-Blöcke (wie YouTube-Chapters): manuell im
 * Editor gepflegt oder per KI aus dem Transkript vorgeschlagen. Gespeichert
 * als JSON am Block: [{ t: sekunden, title }] – immer sortiert.
 */

export interface Chapter {
  /** Startzeit in Sekunden */
  t: number;
  title: string;
}

export const MAX_CHAPTERS = 50;

export const chapterSchema = z.object({
  t: z.number().min(0).max(24 * 60 * 60),
  title: z.string().trim().min(1).max(120),
});

export const chaptersSchema = z
  .array(chapterSchema)
  .max(MAX_CHAPTERS)
  .optional();

/** DB-Json → validierte, sortierte Kapitelliste (kaputt → leer). */
export function parseChapters(json: unknown): Chapter[] {
  if (!Array.isArray(json)) return [];
  const chapters: Chapter[] = [];
  for (const entry of json) {
    const parsed = chapterSchema.safeParse(entry);
    if (parsed.success) {
      chapters.push({ t: Math.floor(parsed.data.t), title: parsed.data.title });
    }
  }
  return sortChapters(chapters).slice(0, MAX_CHAPTERS);
}

/** Nach Startzeit sortieren, doppelte Startzeiten zusammenfassen (letzte gewinnt). */
export function sortChapters(chapters: Chapter[]): Chapter[] {
  const byTime = new Map<number, Chapter>();
  for (const chapter of chapters) {
    byTime.set(Math.floor(chapter.t), {
      t: Math.floor(chapter.t),
      title: chapter.title.trim(),
    });
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

/** Kapitel, das zur Abspielzeit gehört (null vor dem ersten Kapitel). */
export function activeChapterAt(
  chapters: Chapter[],
  seconds: number
): Chapter | null {
  let active: Chapter | null = null;
  for (const chapter of chapters) {
    if (chapter.t <= seconds) active = chapter;
    else break;
  }
  return active;
}

/** Sekunden → "m:ss" bzw. "h:mm:ss" (für Zeit-Eingaben und Anzeige). */
export function formatChapterTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** "m:ss" / "h:mm:ss" / "90" → Sekunden; null bei unlesbarer Eingabe. */
export function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(trimmed);
  if (!match) return null;
  const [, a, b, c] = match;
  if (c !== undefined) {
    return Number(a) * 3600 + Number(b) * 60 + Number(c);
  }
  return Number(a) * 60 + Number(b);
}

/* ---------- KI-Vorschlag aus dem Transkript ---------- */

export const CHAPTER_MODEL = "gpt-4o-mini";

/** Prompt: Transkript → Kapitel als striktes JSON. */
export function buildChapterPrompt(input: {
  transcript: string;
  durationSeconds: number;
  language: string;
}): string {
  const langName = input.language === "en" ? "Englisch" : "Deutsch";
  return [
    `Du erstellst Kapitelmarker für ein Lernvideo (Dauer: ${Math.floor(input.durationSeconds)} Sekunden).`,
    `Teile den Inhalt in 3–10 sinnvolle Kapitel. Regeln:`,
    `- Erstes Kapitel beginnt bei 0.`,
    `- Startzeiten in Sekunden, aufsteigend, alle kleiner als die Dauer.`,
    `- Titel kurz und konkret (max. 60 Zeichen), Sprache: ${langName}.`,
    `- Antworte NUR mit JSON: {"chapters":[{"t":0,"title":"..."}]}`,
    ``,
    `Transkript:`,
    input.transcript.slice(0, 24_000),
  ].join("\n");
}

/** Modell-Antwort → validierte Kapitel (geklemmt auf die Mediendauer). */
export function parseChapterResponse(
  raw: string,
  durationSeconds: number
): Chapter[] {
  try {
    // Modelle verpacken JSON gern in ```-Zäune
    const jsonText = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "");
    const parsed = JSON.parse(jsonText) as { chapters?: unknown };
    const chapters = parseChapters(parsed.chapters);
    return chapters.filter(
      (chapter) =>
        durationSeconds <= 0 || chapter.t < Math.floor(durationSeconds)
    );
  } catch {
    return [];
  }
}
