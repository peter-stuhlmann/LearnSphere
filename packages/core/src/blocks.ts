import { z } from "zod";
import { chaptersSchema } from "./chapters";
import { COURSE_LANGUAGES } from "./course-i18n";
import { isLocalUploadUrl } from "./media-url";
import { CONTENT_PROVENANCES } from "./provenance";

export const BLOCK_TYPES = [
  "VIDEO",
  "AUDIO",
  "IMAGE",
  "FILE",
  "TEXT",
  "HTML",
] as const;

export type BlockTypeName = (typeof BLOCK_TYPES)[number];

/** Erlaubt http(s)-URLs und relative Upload-Pfade (/uploads/…, geschützte
    Video-Pfade /api/media/v/…). */
const safeUrl = z
  .string()
  .trim()
  .min(1, "url_required")
  .max(2000)
  .refine(
    (value) => {
      if (isLocalUploadUrl(value)) return true;
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "url_invalid" }
  );

/**
 * Übersetzungs-Overrides eines Blocks je Sprache. Leere Felder bedeuten
 * "keine Übersetzung" → die Lernansicht fällt auf die Basissprache zurück
 * (Medien bekommen dort ein "Original"-Badge).
 */
const blockTranslationSchema = z.object({
  title: z.string().trim().max(200).default(""),
  url: z.union([safeUrl, z.literal("")]).default(""),
  fileName: z.string().trim().max(200).default(""),
  poster: z.union([safeUrl, z.literal("")]).default(""),
  content: z.string().trim().max(100_000).default(""),
  durationSeconds: z.number().int().min(0).default(0),
  /// Herkunft des übersetzten Inhalts (Fußnote für Lernende)
  provenance: z.enum(CONTENT_PROVENANCES).default("HUMAN"),
});

const blockTranslations = z
  .partialRecord(z.enum(COURSE_LANGUAGES), blockTranslationSchema)
  .default({});

const base = {
  title: z.string().trim().max(200).optional().or(z.literal("")),
  translations: blockTranslations,
};

/** Transkript je Sprache – auto-transkribiert (Uploads) oder manuell gepflegt. */
const transcript = z.string().trim().max(200_000).default("");

/**
 * Zeitgestempeltes Transkript-Segment (aus Whisper) für die Karaoke-Anzeige
 * im Player. Texte sind Plain-Text; fehlende Übersetzung = leerer String.
 */
export const transcriptCueSchema = z.object({
  start: z.number().min(0).max(360_000),
  end: z.number().min(0).max(360_000),
  de: z.string().trim().max(2_000).default(""),
  en: z.string().trim().max(2_000).default(""),
  /**
   * Sprecher aus der Diarization: Nummer ("1", "2", …) oder vom Creator
   * vergebener Name ("Anna"); "" = unbekannt/kein Sprecher
   */
  speaker: z.string().trim().max(40).default(""),
});

export type TranscriptCue = z.infer<typeof transcriptCueSchema>;

/** Deckel: 4 h Material à ~2-Sekunden-Segmente. */
const transcriptCues = z.array(transcriptCueSchema).max(7_500).default([]);

/** DB-Json sicher in Cues verwandeln; alles Unerwartete wird zu []. */
export function parseTranscriptCues(value: unknown): TranscriptCue[] {
  const parsed = transcriptCues.safeParse(value ?? []);
  return parsed.success ? parsed.data : [];
}

export const lessonBlockSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("VIDEO"),
    url: safeUrl,
    /// Vorschaubild; "" = keins (Upload befüllt es automatisch mit Frame 1)
    poster: z.union([safeUrl, z.literal("")]).default(""),
    durationSeconds: z.number().int().min(0).default(0),
    transcriptDe: transcript,
    transcriptEn: transcript,
    transcriptCues,
    chapters: chaptersSchema,
  }),
  z.object({
    ...base,
    type: z.literal("AUDIO"),
    url: safeUrl,
    durationSeconds: z.number().int().min(0).default(0),
    transcriptDe: transcript,
    transcriptEn: transcript,
    transcriptCues,
    chapters: chaptersSchema,
  }),
  z.object({
    ...base,
    type: z.literal("IMAGE"),
    url: safeUrl,
  }),
  z.object({
    ...base,
    type: z.literal("FILE"),
    url: safeUrl,
    fileName: z.string().trim().max(200).optional().or(z.literal("")),
  }),
  z.object({
    ...base,
    type: z.literal("TEXT"),
    content: z.string().trim().min(1, "content_required").max(50_000),
    provenance: z.enum(CONTENT_PROVENANCES).default("HUMAN"),
  }),
  z.object({
    ...base,
    type: z.literal("HTML"),
    content: z.string().trim().min(1, "content_required").max(100_000),
    css: z.string().trim().max(100_000).optional().or(z.literal("")),
    provenance: z.enum(CONTENT_PROVENANCES).default("HUMAN"),
  }),
]);

export const lessonSchema = z.object({
  title: z.string().trim().min(1, "title_too_short").max(200),
  isPreview: z.boolean().default(false),
  blocks: z.array(lessonBlockSchema).min(1, "lesson_needs_block").max(50),
  /// Übersetzte Lektionstitel je Sprache; leer = Basistitel
  translations: z
    .partialRecord(
      z.enum(COURSE_LANGUAGES),
      z.object({ title: z.string().trim().max(200).default("") })
    )
    .default({}),
});

export type LessonBlockInput = z.input<typeof lessonBlockSchema>;
export type LessonInput = z.input<typeof lessonSchema>;

/** Gesamtdauer einer Lektion = Summe der Video-/Audio-Blöcke. */
export function lessonDurationFromBlocks(
  blocks: { type: string; durationSeconds?: number }[]
): number {
  return blocks
    .filter((b) => b.type === "VIDEO" || b.type === "AUDIO")
    .reduce((sum, b) => sum + Math.max(0, b.durationSeconds ?? 0), 0);
}
