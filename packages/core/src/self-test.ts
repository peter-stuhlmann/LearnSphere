import { createHash } from "node:crypto";
import { z } from "zod";
import { htmlToPlainText } from "./html-text";

/**
 * KI-Selbsttests ("Teste dich"): 3–5 Übungsfragen je Lektion, generiert aus
 * den Lektionsinhalten (Texte + Transkripte). Reines Lernwerkzeug – zählt
 * in keine Prüfung. Der contentHash bindet die Fragen an den Inhaltsstand:
 * ändert der Creator die Lektion, wird frisch generiert.
 */

export const SELF_TEST_MODEL = "gpt-4o-mini";
export const SELF_TEST_QUESTION_COUNT = 4;

export const selfTestOptionSchema = z.object({
  text: z.string().trim().min(1).max(300),
  correct: z.boolean(),
});

export const selfTestQuestionSchema = z.object({
  prompt: z.string().trim().min(5).max(500),
  options: z
    .array(selfTestOptionSchema)
    .min(3)
    .max(5)
    // genau eine richtige Antwort
    .refine((opts) => opts.filter((o) => o.correct).length === 1),
  explanation: z.string().trim().min(1).max(600),
});

export type SelfTestOption = z.infer<typeof selfTestOptionSchema>;
export type SelfTestQuestion = z.infer<typeof selfTestQuestionSchema>;

/** Lerntext einer Lektion (Blöcke → Plain-Text) für Prompt und Hash. */
export function lessonStudyText(
  blocks: {
    type: string;
    content?: string | null;
    transcriptDe?: string | null;
    transcriptEn?: string | null;
  }[],
  lang: string
): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "TEXT" && block.content) {
      parts.push(htmlToPlainText(block.content));
    }
    if (block.type === "VIDEO" || block.type === "AUDIO") {
      const transcript =
        lang === "en"
          ? block.transcriptEn || block.transcriptDe
          : block.transcriptDe || block.transcriptEn;
      if (transcript) parts.push(htmlToPlainText(transcript));
    }
  }
  return parts.join("\n\n").trim();
}

/** Inhalts-Hash: gleiche Inhalte → gleiche Fragen (Cache über alle Nutzer). */
export function selfTestContentHash(studyText: string, lang: string): string {
  return createHash("sha256")
    .update(`${SELF_TEST_MODEL}|${lang}|${studyText}`)
    .digest("hex");
}

/** Mindestmenge an Lernstoff, unter der Fragen keinen Sinn ergeben. */
export const SELF_TEST_MIN_CHARS = 300;

/**
 * Reicht der Lernstoff einer Lektion für einen Selbsttest? Vorab berechenbar –
 * die Lernansicht blendet "Teste dich" sonst gar nicht erst ein (dieselbe
 * Schwelle prüft die Action serverseitig weiterhin).
 */
export function hasSelfTestContent(
  blocks: Parameters<typeof lessonStudyText>[0],
  lang: string
): boolean {
  return lessonStudyText(blocks, lang).length >= SELF_TEST_MIN_CHARS;
}

export function buildSelfTestPrompt(input: {
  studyText: string;
  lang: string;
}): string {
  const langName = input.lang === "en" ? "Englisch" : "Deutsch";
  return [
    `Erstelle ${SELF_TEST_QUESTION_COUNT} Übungsfragen (Single-Choice) zum folgenden Lernstoff.`,
    `Regeln:`,
    `- Jede Frage hat genau 4 Antwortoptionen, GENAU EINE ist korrekt.`,
    `- Falsche Optionen müssen plausibel sein (keine Scherzantworten).`,
    `- Frage NUR nach Inhalten, die im Lernstoff vorkommen.`,
    `- Kurze Erklärung (1–2 Sätze), warum die richtige Antwort stimmt.`,
    `- Sprache: ${langName}.`,
    `- Antworte NUR mit JSON:`,
    `{"questions":[{"prompt":"...","options":[{"text":"...","correct":true},{"text":"...","correct":false}],"explanation":"..."}]}`,
    ``,
    `Lernstoff:`,
    input.studyText.slice(0, 24_000),
  ].join("\n");
}

/** Modell-Antwort → validierte Fragen (ungültige Fragen werden verworfen). */
export function parseSelfTestResponse(raw: string): SelfTestQuestion[] {
  try {
    const jsonText = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "");
    const parsed = JSON.parse(jsonText) as { questions?: unknown };
    if (!Array.isArray(parsed.questions)) return [];
    const questions: SelfTestQuestion[] = [];
    for (const entry of parsed.questions) {
      const result = selfTestQuestionSchema.safeParse(entry);
      if (result.success) questions.push(result.data);
    }
    return questions.slice(0, SELF_TEST_QUESTION_COUNT + 1);
  } catch {
    return [];
  }
}

/** DB-Json → Optionen (kaputte Datensätze → leer, Frage wird ausgelassen). */
export function parseSelfTestOptions(json: unknown): SelfTestOption[] {
  const parsed = z.array(selfTestOptionSchema).safeParse(json);
  return parsed.success ? parsed.data : [];
}
