import { describe, expect, it } from "vitest";
import { publicCourseListSchema, publicCourseSchema } from "./catalog";

const course = {
  id: "c1",
  slug: "video-kurs",
  title: "Videokurs",
  subtitle: "Untertitel",
  language: "de",
  languages: ["de", "en"],
  priceCents: 4999,
  currency: "EUR",
  category: "design",
  tags: ["figma"],
  creatorName: "Ada",
  sectionCount: 3,
  lessonCount: 12,
  averageRating: 4.5,
  reviewCount: 10,
  url: "https://example.com/de/courses/video-kurs",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("catalog contracts", () => {
  it("akzeptiert Kurskarten inkl. Nullable-Feldern", () => {
    expect(publicCourseSchema.safeParse(course).success).toBe(true);
    expect(
      publicCourseSchema.safeParse({
        ...course,
        subtitle: null,
        category: null,
        averageRating: null,
      }).success
    ).toBe(true);
  });

  it("validiert Listen mit Paging-Meta", () => {
    expect(
      publicCourseListSchema.safeParse({
        data: [course],
        meta: { total: 1, page: 1, pages: 1, per: 12 },
      }).success
    ).toBe(true);
    expect(
      publicCourseListSchema.safeParse({ data: [course] }).success
    ).toBe(false);
  });
});
