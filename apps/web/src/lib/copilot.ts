import { z } from "zod";

/**
 * Kurs-Copilot: KI-Vorschläge EINZELN je Feld (Titel, Untertitel,
 * Beschreibung, Tags) statt als teurer Rundumschlag – der Creator holt
 * sich gezielt nur, was er braucht. Dazu: markierten Text der
 * Beschreibung über das Bubble-Menü verbessern lassen.
 */

export const COPILOT_MODEL = "gpt-4o-mini";

/** Mindestmenge an Kursinhalt für sinnvolle Vorschläge. */
export const COPILOT_MIN_CHARS = 400;

/** Kursinhalt-Deckel pro Anfrage – hält die Input-Token klein. */
export const COPILOT_STUDY_LIMIT = 12_000;

export const COPILOT_FIELDS = [
  "title",
  "subtitle",
  "description",
  "tags",
] as const;

export type CopilotField = (typeof COPILOT_FIELDS)[number];

/** Ausgabe-Deckel je Feld (Token sparen: kurze Felder = kurze Antworten). */
export const COPILOT_MAX_TOKENS: Record<CopilotField, number> = {
  title: 80,
  subtitle: 140,
  description: 900,
  tags: 140,
};

const FIELD_TASKS: Record<CopilotField, { de: string; en: string }> = {
  title: {
    de: `"value": ein prägnanter Kurstitel (max. 90 Zeichen), konkret und ohne Clickbait.`,
    en: `"value": a concise course title (max. 90 characters), specific and without clickbait.`,
  },
  subtitle: {
    de: `"value": ein prägnanter Untertitel (max. 160 Zeichen), macht neugierig, ohne Clickbait.`,
    en: `"value": a concise subtitle (max. 160 characters) that sparks curiosity without clickbait.`,
  },
  description: {
    de: `"value": 2–4 Absätze Kursbeschreibung als Array von Strings – was lernt man, für wen ist es, was kann man danach. Konkret und aus den Inhalten belegt.`,
    en: `"value": 2–4 course description paragraphs as an array of strings – what you learn, who it's for, what you can do afterwards. Specific and grounded in the content.`,
  },
  tags: {
    de: `"value": 5–8 kurze Suchbegriffe als Array (Kleinschreibung, je 1–2 Wörter).`,
    en: `"value": 5–8 short search keywords as an array (lowercase, 1–2 words each).`,
  },
};

/** Gezielter Prompt für genau EIN Feld. */
export function buildFieldPrompt(
  field: CopilotField,
  input: { courseTitle: string; studyText: string; lang: string }
): string {
  const lang = input.lang === "en" ? "en" : "de";
  const intro =
    lang === "en"
      ? `You are a marketing copywriter for an e-learning platform. For the course "${input.courseTitle}", create from the course content:`
      : `Du bist Marketing-Texter für eine E-Learning-Plattform. Erstelle für den Kurs "${input.courseTitle}" aus den Kursinhalten:`;
  const answer =
    lang === "en"
      ? "Language: English. Answer ONLY with JSON:"
      : "Sprache: Deutsch. Antworte NUR mit JSON:";
  return [
    intro,
    FIELD_TASKS[field][lang],
    `${answer} {"value": ...}`,
    "",
    lang === "en" ? "Course content:" : "Kursinhalte:",
    input.studyText.slice(0, COPILOT_STUDY_LIMIT),
  ].join("\n");
}

const FIELD_SCHEMAS: Record<CopilotField, z.ZodType<string | string[]>> = {
  title: z.string().trim().min(3).max(120),
  subtitle: z.string().trim().min(10).max(200),
  description: z.array(z.string().trim().min(20).max(1200)).min(1).max(5),
  tags: z.array(z.string().trim().min(2).max(30)).min(3).max(10),
};

/** Modell-Antwort → validierter Feldwert (null bei kaputter Antwort). */
export function parseFieldResponse(
  field: CopilotField,
  raw: string
): string | string[] | null {
  try {
    const jsonText = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "");
    const parsed = z
      .object({ value: FIELD_SCHEMAS[field] })
      .safeParse(JSON.parse(jsonText));
    return parsed.success ? parsed.data.value : null;
  } catch {
    return null;
  }
}

/* ---------- Markierten Text verbessern (Bubble-Menü) ---------- */

export const IMPROVE_MIN_CHARS = 3;
export const IMPROVE_MAX_CHARS = 4_000;

export function buildImprovePrompt(input: {
  text: string;
  lang: string;
}): string {
  const lang = input.lang === "en" ? "en" : "de";
  const instruction =
    lang === "en"
      ? "Improve the following text stylistically and grammatically. Keep the language, meaning and approximate length. Answer ONLY with JSON:"
      : "Verbessere den folgenden Text stilistisch und grammatikalisch. Behalte Sprache, Bedeutung und ungefähre Länge bei. Antworte NUR mit JSON:";
  return [
    instruction,
    `{"value": "verbesserter Text"}`,
    "",
    input.text.slice(0, IMPROVE_MAX_CHARS),
  ].join("\n");
}

export function parseImproveResponse(raw: string): string | null {
  try {
    const jsonText = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "");
    const parsed = z
      .object({ value: z.string().trim().min(1).max(10_000) })
      .safeParse(JSON.parse(jsonText));
    return parsed.success ? parsed.data.value : null;
  } catch {
    return null;
  }
}

/** Absätze → sanitisierbares Beschreibungs-HTML (<p>…</p>). */
export function paragraphsToHtml(paragraphs: string[]): string {
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
