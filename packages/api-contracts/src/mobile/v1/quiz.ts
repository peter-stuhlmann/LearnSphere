import { z } from "zod";

/* Contracts der Prüfungs-Endpoints. Fragen kommen OHNE Lösungen
   (isCorrect/expectedAnswer bleiben serverseitig). */

export const attemptStateSchema = z.object({
  allowed: z.boolean(),
  reason: z
    .enum(["cooldown", "already_passed", "attempts_exhausted"])
    .nullable(),
  nextAttemptAt: z.string().nullable(),
  attemptsUsed: z.number(),
  maxAttempts: z.number().nullable(),
});
export type AttemptState = z.infer<typeof attemptStateSchema>;

export const quizForAttemptSchema = z.object({
  quiz: z.object({
    id: z.string(),
    courseId: z.string(),
    kind: z.enum(["FINAL", "SECTION"]),
    title: z.string(),
    passPercent: z.number(),
    timeLimitMinutes: z.number().nullable(),
    /** Restzeit des laufenden Versuchs in Sekunden; null = ohne Limit */
    remainingSeconds: z.number().nullable(),
  }),
  attempt: attemptStateSchema,
  questions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      kind: z.enum(["SINGLE", "MULTIPLE", "FREE_TEXT"]),
      points: z.number(),
      options: z.array(z.object({ id: z.string(), text: z.string() })),
    })
  ),
});
export type QuizForAttempt = z.infer<typeof quizForAttemptSchema>;

export const quizSubmitRequestSchema = z.object({
  answers: z.record(z.string(), z.array(z.string().max(2000)).max(50)),
});
export type QuizSubmitRequest = z.infer<typeof quizSubmitRequestSchema>;

export const quizSubmitResponseSchema = z.object({
  scorePercent: z.number(),
  passed: z.boolean(),
  certificateSerial: z.string().nullable(),
  earnedPoints: z.number(),
  totalPoints: z.number(),
  perQuestion: z.array(
    z.object({
      questionId: z.string(),
      correct: z.boolean(),
      points: z.number(),
    })
  ),
});
export type QuizSubmitResponse = z.infer<typeof quizSubmitResponseSchema>;

/** Zertifikatsliste (GET /api/mobile/v1/my/certificates) */
export const certificateItemSchema = z.object({
  serial: z.string(),
  courseTitle: z.string(),
  scorePercent: z.number(),
  issuedAt: z.string(),
});
export type CertificateItem = z.infer<typeof certificateItemSchema>;
