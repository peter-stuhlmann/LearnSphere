import { z } from "zod";

/** Kurskarte des öffentlichen Katalogs (GET /api/public/v1/courses). */
export const publicCourseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  language: z.string(),
  languages: z.array(z.string()),
  priceCents: z.number(),
  currency: z.string(),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  creatorName: z.string(),
  sectionCount: z.number(),
  lessonCount: z.number(),
  averageRating: z.number().nullable(),
  reviewCount: z.number(),
  url: z.string(),
  createdAt: z.string(),
});
export type PublicCourse = z.infer<typeof publicCourseSchema>;

export const publicCourseListSchema = z.object({
  data: z.array(publicCourseSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    pages: z.number(),
    per: z.number(),
  }),
});
export type PublicCourseList = z.infer<typeof publicCourseListSchema>;
