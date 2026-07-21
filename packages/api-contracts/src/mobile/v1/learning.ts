import { z } from "zod";

/* Contracts der Lern-Endpoints: Mein Lernen, Kurs-Gliederung, Lektion. */

/** Eintrag in "Mein Lernen" (GET /api/mobile/v1/my/enrollments) */
export const enrollmentItemSchema = z.object({
  courseId: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  coverImage: z.string().nullable(),
  watchPercent: z.number(),
  lessonCount: z.number(),
  completedLessons: z.number(),
  lastLessonId: z.string().nullable(),
  lastVisitedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  certificateSerial: z.string().nullable(),
});
export type EnrollmentItem = z.infer<typeof enrollmentItemSchema>;

export const enrollmentListSchema = z.object({
  data: z.array(enrollmentItemSchema),
});
export type EnrollmentList = z.infer<typeof enrollmentListSchema>;

/** Kurs-Gliederung für den Player (GET /api/mobile/v1/my/courses/[id]) */
export const outlineLessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationSeconds: z.number(),
  isPreview: z.boolean(),
  watchedSeconds: z.number(),
  completed: z.boolean(),
});
export type OutlineLesson = z.infer<typeof outlineLessonSchema>;

export const outlineQuizSchema = z.object({
  id: z.string(),
  title: z.string(),
  passPercent: z.number(),
  passed: z.boolean(),
});

export const courseOutlineSchema = z.object({
  course: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    requiredWatchPercent: z.number(),
    finalExamRequired: z.boolean(),
    watchPercent: z.number(),
    lastLessonId: z.string().nullable(),
  }),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      lessons: z.array(outlineLessonSchema),
      quiz: outlineQuizSchema.nullable(),
    })
  ),
  finalQuiz: outlineQuizSchema
    .extend({ eligible: z.boolean() })
    .nullable(),
});
export type CourseOutline = z.infer<typeof courseOutlineSchema>;

/** Lektion mit aufgelösten Blöcken (GET /api/mobile/v1/lessons/[id]) */
export const lessonBlockSchema = z.object({
  id: z.string(),
  type: z.enum(["VIDEO", "AUDIO", "IMAGE", "FILE", "TEXT", "HTML"]),
  title: z.string().nullable(),
  /** lokale Medien: signierte relative URL; extern: Original-URL */
  url: z.string().nullable(),
  fileName: z.string().nullable(),
  poster: z.string().nullable(),
  content: z.string().nullable(),
  durationSeconds: z.number(),
  chapters: z
    .array(z.object({ t: z.number(), title: z.string() }))
    .nullable(),
  /** true = Medium/Text lief auf die Basissprache zurück */
  mediaFallback: z.boolean(),
  textFallback: z.boolean(),
});
export type LessonBlockDto = z.infer<typeof lessonBlockSchema>;

export const lessonDetailSchema = z.object({
  lesson: z.object({
    id: z.string(),
    title: z.string(),
    sectionId: z.string(),
    courseId: z.string(),
    durationSeconds: z.number(),
    isPreview: z.boolean(),
  }),
  blocks: z.array(lessonBlockSchema),
  progress: z.object({
    watchedSeconds: z.number(),
    completed: z.boolean(),
    positions: z.record(z.string(), z.number()),
  }),
  neighbors: z.object({
    prevLessonId: z.string().nullable(),
    nextLessonId: z.string().nullable(),
  }),
});
export type LessonDetail = z.infer<typeof lessonDetailSchema>;

/** PATCH /api/mobile/v1/lessons/[id]/progress */
export const progressUpdateSchema = z.object({
  watchedSeconds: z.number().min(0).max(1_000_000),
  forceComplete: z.boolean().optional(),
  positions: z.record(z.string(), z.number().min(0)).optional(),
});
export type ProgressUpdate = z.infer<typeof progressUpdateSchema>;
