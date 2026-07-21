import { z } from "zod";
import { isCourseCategory } from "./categories";
import { COURSE_LANGUAGES } from "./course-i18n";
import { normalizeTags } from "./tags";

export const SUPPORTED_LANGUAGES = COURSE_LANGUAGES;

export const passwordSchema = z
  .string()
  .min(8, "password_too_short")
  .regex(/\d/, "password_needs_digit")
  .regex(/\p{L}/u, "password_needs_letter");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "name_too_short").max(100),
    email: z.email("email_invalid").transform((value) => value.toLowerCase()),
    password: passwordSchema,
    /// Tippfehler-Schutz: muss identisch zum Passwort sein
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwords_mismatch",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  /// Auth.js serialisiert fehlende Felder als String "undefined" in den
  /// Form-Body – solche Werte zählen als "kein Code angegeben"
  totp: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim() && value !== "undefined" ? value.trim() : undefined
    ),
});

/** Bezahlkurse kosten mindestens 4,99 € – darunter gibt es nur „kostenlos". */
export const MIN_PRICE_CENTS = 499;

/** Übersetzung der Kurs-Metatexte; leere Felder = Fallback auf die Basissprache */
const courseTranslationSchema = z.object({
  title: z.string().trim().max(120).default(""),
  subtitle: z.string().trim().max(200).default(""),
  description: z.string().trim().max(10000).default(""),
});

export const courseSchema = z.object({
  title: z.string().trim().min(3, "title_too_short").max(120),
  subtitle: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(10000).optional().or(z.literal("")),
  language: z.enum(SUPPORTED_LANGUAGES),
  /// Weitere Kurssprachen neben der Basissprache `language`
  extraLanguages: z.array(z.enum(SUPPORTED_LANGUAGES)).default([]),
  /// Übersetzungs-Overrides je Zusatzsprache
  translations: z
    .partialRecord(z.enum(SUPPORTED_LANGUAGES), courseTranslationSchema)
    .default({}),
  priceCents: z
    .number()
    .int("price_not_integer")
    .min(0, "price_negative")
    .refine((cents) => cents === 0 || cents >= MIN_PRICE_CENTS, {
      message: "price_below_minimum",
    }),
  requiredWatchPercent: z.number().int().min(0).max(100),
  finalExamRequired: z.boolean(),
  /// KI-Selbsttests ("Teste dich") in den Lektionen
  selfTestsEnabled: z.boolean().default(true),
  listedInShop: z.boolean().default(true),
  /// Warteliste: "Demnächst"-Seite mit E-Mail-Eintragung, solange der Kurs
  /// unveröffentlicht ist; bei Veröffentlichung wird benachrichtigt
  waitlistEnabled: z.boolean().default(false),
  /// Kursbild: Pfad aus dem eigenen Upload (Pflicht fürs Veröffentlichen)
  coverImage: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .default(null)
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || value.startsWith("/uploads/"), {
      message: "cover_invalid",
    }),
  /// genau eine Kategorie aus der festen Liste; null = keine
  category: z
    .string()
    .nullable()
    .default(null)
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || isCourseCategory(value), {
      message: "category_invalid",
    }),
  /// freie Tags, serverseitig normalisiert und begrenzt
  tags: z.array(z.string().max(100)).max(50).default([]).transform(normalizeTags),
  /// Live-Termine (termine.lol): Checkbox "Termine anbieten". Die Verbindung
  /// (Kalender-ID + API-Key) entsteht über den Connect-Flow, nie über dieses
  /// Formular – angeboten wird erst, wenn Checkbox UND Verbindung da sind.
  bookingEnabled: z.boolean().default(false),
})
  .transform((data) => {
    /// Basissprache zählt nie als Zusatzsprache; Übersetzungen nur für
    /// aktivierte Sprachen behalten
    const extraLanguages = [...new Set(data.extraLanguages)].filter(
      (lang) => lang !== data.language
    );
    const translations = Object.fromEntries(
      Object.entries(data.translations).filter(([lang]) =>
        (extraLanguages as string[]).includes(lang)
      )
    );
    return {
      ...data,
      extraLanguages,
      translations,
      /// Kostenlose Kurse sind immer im Shop gelistet – der einzige Kaufweg dorthin
      listedInShop: data.priceCents === 0 ? true : data.listedInShop,
    };
  });

/**
 * Freitext-Fragen brauchen keine Antwortoptionen – der Editor behält beim
 * Umschalten aber seine (ggf. leeren) Options-Entwürfe. Die werden hier vor
 * der Validierung verworfen, statt an `options[].text min(1)` zu scheitern.
 */
const dropOptionsForFreeText = (raw: unknown) =>
  raw !== null &&
  typeof raw === "object" &&
  (raw as { kind?: unknown }).kind === "FREE_TEXT"
    ? { ...(raw as object), options: [] }
    : raw;

export const questionSchema = z.preprocess(
  dropOptionsForFreeText,
  z
    .object({
      text: z.string().trim().min(1).max(2000),
      kind: z.enum(["SINGLE", "MULTIPLE", "FREE_TEXT"]),
      /// Gewichtung der Frage in der Bewertung (Standard 1)
      points: z.number().int().min(1, "points_too_small").max(100).default(1),
      options: z
        .array(
          z.object({
            text: z.string().trim().min(1).max(500),
            isCorrect: z.boolean(),
          })
        )
        .default([]),
      /// Freitext: Musterlösung bzw. exakt erwartete Antwort
      expectedAnswer: z.string().trim().max(2000).nullable().default(null),
      /// Freitext: KI bewertet sinngemäß statt exaktem Vergleich
      aiGraded: z.boolean().default(false),
    })
    .superRefine((q, ctx) => {
      if (q.kind === "FREE_TEXT") {
        if (!q.expectedAnswer) {
          ctx.addIssue({
            code: "custom",
            message: "question_needs_expected_answer",
            path: ["expectedAnswer"],
          });
        }
        return;
      }
      if (q.options.length < 2) {
        ctx.addIssue({
          code: "custom",
          message: "question_needs_two_options",
          path: ["options"],
        });
      } else if (!q.options.some((o) => o.isCorrect)) {
        ctx.addIssue({
          code: "custom",
          message: "question_needs_correct_option",
          path: ["options"],
        });
      }
    })
);

export const quizSchema = z.object({
  title: z.string().trim().min(3).max(120),
  passPercent: z.number().int().min(0).max(100),
  maxAttempts: z.number().int().min(1).max(1000).nullable().default(null),
  attemptWindowHours: z
    .number()
    .int()
    .min(1)
    .max(8760)
    .nullable()
    .default(null),
  retakeAfterPass: z.boolean().default(true),
  shuffleQuestions: z.boolean().default(false),
  shuffleAnswers: z.boolean().default(false),
  /// Zeitlimit in Minuten; null = ohne Zeitbegrenzung (Standard)
  timeLimitMinutes: z
    .number()
    .int()
    .min(1)
    .max(480)
    .nullable()
    .default(null),
  questions: z.array(questionSchema).min(1, "quiz_needs_question"),
});

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "code_too_short")
      .max(32)
      .regex(/^[A-Za-z0-9-]+$/, "code_invalid_chars")
      .transform((value) => value.toUpperCase()),
    kind: z.enum(["PERCENT", "AMOUNT_OFF", "FIXED_PRICE"]),
    value: z.number().int().min(1, "value_too_small"),
    maxRedemptions: z.number().int().min(1).nullable().default(null),
    validFrom: z.date().nullable().default(null),
    validUntil: z.date().nullable().default(null),
    courseIds: z
      .array(z.string().min(1))
      .min(1, "no_courses")
      .transform((ids) => [...new Set(ids)]),
  })
  .refine((c) => c.kind !== "PERCENT" || c.value <= 100, {
    message: "percent_above_100",
    path: ["value"],
  })
  .refine(
    (c) => !c.validFrom || !c.validUntil || c.validFrom <= c.validUntil,
    { message: "window_invalid", path: ["validUntil"] }
  );

export const profileSchema = z.object({
  name: z.string().trim().min(2, "name_too_short").max(100),
});

export const SUPPORTED_COUNTRIES = ["DE", "AT", "CH", "NL", "FR", "IT", "ES", "PL", "GB", "US"] as const;

export const billingAddressSchema = z.object({
  firstName: z.string().trim().min(1, "first_name_required").max(100),
  lastName: z.string().trim().min(1, "last_name_required").max(100),
  street: z.string().trim().min(3, "street_required").max(200),
  addressExtra: z.string().trim().max(200).optional().or(z.literal("")),
  zip: z.string().trim().min(3, "zip_invalid").max(10),
  city: z.string().trim().min(1, "city_required").max(100),
  country: z.enum(SUPPORTED_COUNTRIES),
  email: z.email("email_invalid").transform((value) => value.toLowerCase()),
});

export type BillingAddressInput = z.infer<typeof billingAddressSchema>;

/** Pfade/Begriffe, die nicht als Creator-Handle vergeben werden dürfen. */
const RESERVED_HANDLES = new Set([
  "admin",
  "api",
  "app",
  "c",
  "courses",
  "dashboard",
  "embed",
  "learn",
  "learnsphere",
  "login",
  "profile",
  "register",
  "settings",
  "shop",
  "support",
  "www",
]);

export const storefrontSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,32}$/, "handle_invalid")
    .refine((value) => !RESERVED_HANDLES.has(value), {
      message: "handle_reserved",
    }),
  storefrontName: z.string().trim().min(2).max(80),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "color_invalid")
    .optional()
    .or(z.literal("")),
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/,
      "domain_invalid"
    )
    .optional()
    .or(z.literal("")),
});

export type StorefrontInput = z.input<typeof storefrontSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type QuizInput = z.input<typeof quizSchema>;
export type CouponInput = z.input<typeof couponSchema>;
