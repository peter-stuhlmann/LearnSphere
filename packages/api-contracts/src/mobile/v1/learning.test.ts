import { describe, expect, it } from "vitest";
import {
  courseOutlineSchema,
  enrollmentListSchema,
  lessonDetailSchema,
  progressUpdateSchema,
} from "./learning";

describe("learning contracts", () => {
  it("validiert die Mein-Lernen-Liste", () => {
    expect(
      enrollmentListSchema.safeParse({
        data: [
          {
            courseId: "c1",
            slug: "kurs",
            title: "Kurs",
            subtitle: null,
            coverImage: null,
            watchPercent: 42,
            lessonCount: 10,
            completedLessons: 4,
            lastLessonId: "l1",
            lastVisitedAt: "2026-07-01T00:00:00.000Z",
            completedAt: null,
            certificateSerial: null,
          },
        ],
      }).success
    ).toBe(true);
  });

  it("validiert die Kurs-Gliederung inkl. Prüfungen", () => {
    expect(
      courseOutlineSchema.safeParse({
        course: {
          id: "c1",
          slug: "kurs",
          title: "Kurs",
          requiredWatchPercent: 80,
          finalExamRequired: true,
          watchPercent: 50,
          lastLessonId: null,
        },
        sections: [
          {
            id: "s1",
            title: "Intro",
            lessons: [
              {
                id: "l1",
                title: "Start",
                durationSeconds: 120,
                isPreview: true,
                watchedSeconds: 60,
                completed: false,
              },
            ],
            quiz: { id: "q1", title: "Zwischentest", passPercent: 70, passed: false },
          },
        ],
        finalQuiz: {
          id: "qf",
          title: "Abschluss",
          passPercent: 70,
          passed: false,
          eligible: false,
        },
      }).success
    ).toBe(true);
  });

  it("validiert Lektions-Detail mit Blöcken und Nachbarn", () => {
    expect(
      lessonDetailSchema.safeParse({
        lesson: {
          id: "l1",
          title: "Start",
          sectionId: "s1",
          courseId: "c1",
          durationSeconds: 120,
          isPreview: false,
        },
        blocks: [
          {
            id: "b1",
            type: "VIDEO",
            title: null,
            url: "/api/media/v/u1/a.mp4?se=1&st=abc",
            fileName: null,
            poster: "/uploads/u1/poster.jpg",
            content: null,
            durationSeconds: 120,
            chapters: [{ t: 0, title: "Intro" }],
            mediaFallback: false,
            textFallback: false,
          },
        ],
        progress: { watchedSeconds: 60, completed: false, positions: { b1: 58 } },
        neighbors: { prevLessonId: null, nextLessonId: "l2" },
      }).success
    ).toBe(true);
  });

  it("begrenzt Progress-Updates", () => {
    expect(
      progressUpdateSchema.safeParse({ watchedSeconds: 42, positions: { b1: 10 } })
        .success
    ).toBe(true);
    expect(progressUpdateSchema.safeParse({ watchedSeconds: -1 }).success).toBe(
      false
    );
  });
});
