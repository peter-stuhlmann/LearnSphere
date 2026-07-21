/**
 * Mehrsprachige Kurse: Ein Kurs hat eine Basissprache (Course.language) und
 * optional weitere Sprachen (Course.extraLanguages, CSV). Übersetzungen leben
 * als JSON-Overrides (`translations`) direkt am jeweiligen Datensatz:
 *
 *   Course.translations  = { en: { title, subtitle, description } }
 *   Section.translations = { en: { title } }
 *   Lesson.translations  = { en: { title } }
 *   LessonBlock.translations = { en: { title, url, fileName, poster,
 *                                      content, durationSeconds } }
 *
 * Fallback-Regel: Ein leerer/fehlender Override bedeutet immer "nimm die
 * Basissprache" – feldweise, nie alles-oder-nichts. Bei Medien (VIDEO/AUDIO/
 * IMAGE/FILE) meldet resolveBlock den Fallback explizit (mediaFallback),
 * damit die Lernansicht z. B. "Original (DE)" anzeigen kann.
 */

import { parseProvenance, type ContentProvenance } from "./provenance";

export const COURSE_LANGUAGES = ["de", "en"] as const;

export type CourseLanguage = (typeof COURSE_LANGUAGES)[number];

export function isCourseLanguage(value: unknown): value is CourseLanguage {
  return (
    typeof value === "string" &&
    (COURSE_LANGUAGES as readonly string[]).includes(value)
  );
}

/** CSV ("en, fr") → gültige Zusatzsprachen ohne Basis, dedupliziert. */
export function parseExtraLanguages(
  csv: string | null | undefined,
  base: string
): CourseLanguage[] {
  if (!csv) return [];
  const seen = new Set<string>();
  const result: CourseLanguage[] = [];
  for (const raw of csv.split(",")) {
    const lang = raw.trim();
    if (!isCourseLanguage(lang) || lang === base || seen.has(lang)) continue;
    seen.add(lang);
    result.push(lang);
  }
  return result;
}

export function serializeExtraLanguages(
  langs: readonly string[],
  base: string
): string {
  return parseExtraLanguages(langs.join(","), base).join(",");
}

/** Alle Sprachen des Kurses, Basissprache zuerst. */
export function courseLanguages(course: {
  language: string;
  extraLanguages?: string | null;
}): string[] {
  return [
    course.language,
    ...parseExtraLanguages(course.extraLanguages, course.language),
  ];
}

/**
 * Ausgeschriebener, lokalisierter Sprachname ("Deutsch"/"German") statt
 * Kürzel – Fallback aufs Großbuchstaben-Kürzel bei unbekannten Codes.
 */
export function languageDisplayName(lang: string, uiLocale: string): string {
  try {
    const name = new Intl.DisplayNames([uiLocale], { type: "language" }).of(
      lang
    );
    if (name && name.toLowerCase() !== lang.toLowerCase()) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  } catch {
    // ungültiger Sprachtag → Fallback unten
  }
  return lang.toUpperCase();
}

/** Erste verfügbare Wunschsprache, sonst die Basissprache (available[0]). */
export function pickCourseLanguage(
  available: readonly string[],
  ...preferred: (string | null | undefined)[]
): string {
  for (const lang of preferred) {
    if (lang && available.includes(lang)) return lang;
  }
  return available[0];
}

/** Overrides einer Sprache sicher aus dem DB-Json lesen. */
function overridesFor(
  translations: unknown,
  locale: string
): Record<string, unknown> {
  if (typeof translations !== "object" || translations === null) return {};
  const entry = (translations as Record<string, unknown>)[locale];
  if (typeof entry !== "object" || entry === null) return {};
  return entry as Record<string, unknown>;
}

function overrideString(
  overrides: Record<string, unknown>,
  field: string
): string | null {
  const value = overrides[field];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** String-Feld: nicht-leere Übersetzung, sonst Basiswert. */
export function translatedText<T extends string | null>(
  translations: unknown,
  locale: string,
  field: string,
  baseValue: T
): string | T {
  return overrideString(overridesFor(translations, locale), field) ?? baseValue;
}

export interface CourseTextFields {
  title: string;
  subtitle: string | null;
  description: string | null;
}

/**
 * Kurs-Metatexte in der Zielsprache, feldweise mit Fallback auf die Basis.
 * subtitle/description dürfen im Select fehlen (schlanke Listen-Queries).
 */
export function resolveCourseText(
  course: {
    title: string;
    subtitle?: string | null;
    description?: string | null;
    language: string;
    translations?: unknown;
  },
  locale: string
): CourseTextFields {
  const base: CourseTextFields = {
    title: course.title,
    subtitle: course.subtitle ?? null,
    description: course.description ?? null,
  };
  if (locale === course.language) return base;
  return {
    title: translatedText(course.translations, locale, "title", base.title),
    subtitle: translatedText(
      course.translations,
      locale,
      "subtitle",
      base.subtitle
    ),
    description: translatedText(
      course.translations,
      locale,
      "description",
      base.description
    ),
  };
}

const MEDIA_BLOCK_TYPES = new Set(["VIDEO", "AUDIO", "IMAGE", "FILE"]);
const TEXT_BLOCK_TYPES = new Set(["TEXT", "HTML"]);

export interface BlockLike {
  type: string;
  title?: string | null;
  url?: string | null;
  fileName?: string | null;
  poster?: string | null;
  content?: string | null;
  durationSeconds?: number;
  translations?: unknown;
  /** Herkunft des Basis-Inhalts (TEXT/HTML), z. B. "AI_REVIEWED" */
  provenance?: string | null;
}

export interface ResolvedBlock {
  title: string | null;
  url: string | null;
  fileName: string | null;
  poster: string | null;
  content: string | null;
  durationSeconds: number;
  /** true = Medium stammt aus der Basissprache (keine Übersetzung vorhanden) */
  mediaFallback: boolean;
  /** true = Text-Inhalt stammt aus der Basissprache */
  textFallback: boolean;
  /** Herkunft des tatsächlich angezeigten Inhalts (Fußnote für Lernende) */
  provenance: ContentProvenance;
}

/**
 * Block in der Zielsprache auflösen. Übersetzte Medien bringen ihre eigene
 * Dauer mit (sonst gilt die der Basis als Näherung); Poster/Dateiname fallen
 * einzeln auf die Basis zurück.
 */
export function resolveBlock(
  block: BlockLike,
  locale: string,
  baseLocale: string
): ResolvedBlock {
  const base: ResolvedBlock = {
    title: block.title ?? null,
    url: block.url ?? null,
    fileName: block.fileName ?? null,
    poster: block.poster ?? null,
    content: block.content ?? null,
    durationSeconds: block.durationSeconds ?? 0,
    mediaFallback: false,
    textFallback: false,
    provenance: parseProvenance(block.provenance),
  };
  if (locale === baseLocale) return base;

  const overrides = overridesFor(block.translations, locale);
  const url = overrideString(overrides, "url");
  const content = overrideString(overrides, "content");
  const overrideDuration = overrides.durationSeconds;

  return {
    title: overrideString(overrides, "title") ?? base.title,
    url: url ?? base.url,
    fileName: overrideString(overrides, "fileName") ?? base.fileName,
    poster: overrideString(overrides, "poster") ?? base.poster,
    content: content ?? base.content,
    durationSeconds:
      url !== null &&
      typeof overrideDuration === "number" &&
      overrideDuration > 0
        ? Math.floor(overrideDuration)
        : base.durationSeconds,
    mediaFallback:
      MEDIA_BLOCK_TYPES.has(block.type) && url === null && base.url !== null,
    textFallback:
      TEXT_BLOCK_TYPES.has(block.type) &&
      content === null &&
      base.content !== null,
    // Herkunft folgt dem tatsächlich angezeigten Text: Übersetzungs-Override
    // trägt seine eigene Kennzeichnung, Fallback erbt die der Basis
    provenance:
      content !== null
        ? parseProvenance(overrides.provenance)
        : base.provenance,
  };
}

/* ---------- Parser: DB-Json → vollständige Editor-Drafts ---------- */

function stringAt(entry: Record<string, unknown>, field: string): string {
  const value = entry[field];
  return typeof value === "string" ? value : "";
}

function languageEntries(json: unknown): [string, Record<string, unknown>][] {
  if (typeof json !== "object" || json === null) return [];
  return Object.entries(json as Record<string, unknown>).flatMap(
    ([lang, entry]) =>
      isCourseLanguage(lang) && typeof entry === "object" && entry !== null
        ? [[lang, entry as Record<string, unknown>] as [string, Record<string, unknown>]]
        : []
  );
}

export interface CourseTranslationDraft {
  title: string;
  subtitle: string;
  description: string;
}

export function parseCourseTranslations(
  json: unknown
): Record<string, CourseTranslationDraft> {
  return Object.fromEntries(
    languageEntries(json).map(([lang, entry]) => [
      lang,
      {
        title: stringAt(entry, "title"),
        subtitle: stringAt(entry, "subtitle"),
        description: stringAt(entry, "description"),
      },
    ])
  );
}

export function parseTitleTranslations(
  json: unknown
): Record<string, { title: string }> {
  return Object.fromEntries(
    languageEntries(json).map(([lang, entry]) => [
      lang,
      { title: stringAt(entry, "title") },
    ])
  );
}

export interface BlockTranslationDraft {
  title: string;
  url: string;
  fileName: string;
  poster: string;
  content: string;
  durationSeconds: number;
  /** Herkunft des übersetzten Inhalts (Fußnote für Lernende) */
  provenance: ContentProvenance;
}

export const EMPTY_BLOCK_TRANSLATION: BlockTranslationDraft = {
  title: "",
  url: "",
  fileName: "",
  poster: "",
  content: "",
  durationSeconds: 0,
  provenance: "HUMAN",
};

export function parseBlockTranslations(
  json: unknown
): Record<string, BlockTranslationDraft> {
  return Object.fromEntries(
    languageEntries(json).map(([lang, entry]) => {
      const duration = entry.durationSeconds;
      return [
        lang,
        {
          title: stringAt(entry, "title"),
          url: stringAt(entry, "url"),
          fileName: stringAt(entry, "fileName"),
          poster: stringAt(entry, "poster"),
          content: stringAt(entry, "content"),
          durationSeconds:
            typeof duration === "number" && duration > 0
              ? Math.floor(duration)
              : 0,
          provenance: parseProvenance(entry.provenance),
        },
      ];
    })
  );
}

/** Anzeigedauer einer Lektion in der Zielsprache (Video/Audio-Blöcke). */
export function lessonDurationForLocale(
  blocks: BlockLike[],
  locale: string,
  baseLocale: string
): number {
  return blocks
    .filter((b) => b.type === "VIDEO" || b.type === "AUDIO")
    .reduce(
      (sum, b) =>
        sum + Math.max(0, resolveBlock(b, locale, baseLocale).durationSeconds),
      0
    );
}
