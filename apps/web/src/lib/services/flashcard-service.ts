import {
  isCardDue,
  newCardState,
  reviewFlashcard,
  type ReviewGrade,
} from "@elearning/core/spaced-repetition";
import { db } from "@/lib/db";
import { recordLearnActivity } from "@/lib/services/activity-service";

/**
 * Spaced Repetition: Karteikarten entstehen automatisch aus den Fragen aller
 * Prüfungen, die der Nutzer bereits versucht hat. Reines Lernwerkzeug –
 * zählt in keine Prüfung oder Statistik hinein.
 */

/** Karten pro Lerneinheit – hält die Session angenehm kurz. */
export const REVIEW_SESSION_LIMIT = 20;

export interface FlashcardOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface Flashcard {
  questionId: string;
  kind: "SINGLE" | "MULTIPLE" | "FREE_TEXT";
  text: string;
  options: FlashcardOption[];
  /** Musterlösung bei Freitextfragen */
  expectedAnswer: string | null;
  courseTitle: string;
  quizTitle: string;
  /** Wiederholungen in Folge – fürs "neu"-Badge (0 = neue Karte) */
  reps: number;
}

export interface ReviewQueue {
  cards: Flashcard[];
  dueCount: number;
  totalCards: number;
  /** nächster Fälligkeitstermin, wenn gerade nichts fällig ist */
  nextDueAt: string | null;
}

/**
 * Fällige Karten des Nutzers über alle versuchten Prüfungen hinweg.
 * Karten ohne Wiederholungszustand sind sofort fällig (neue Karten).
 */
export async function getReviewQueue(userId: string): Promise<ReviewQueue> {
  const attempts = await db.quizAttempt.findMany({
    where: { enrollment: { userId } },
    select: { quizId: true },
    distinct: ["quizId"],
  });
  const quizIds = attempts.map((attempt) => attempt.quizId);
  if (quizIds.length === 0) {
    return { cards: [], dueCount: 0, totalCards: 0, nextDueAt: null };
  }

  const questions = await db.question.findMany({
    where: { quizId: { in: quizIds } },
    include: {
      options: {
        orderBy: { order: "asc" },
        select: { id: true, text: true, isCorrect: true },
      },
      quiz: {
        select: { title: true, course: { select: { title: true } } },
      },
      flashcardReviews: {
        where: { userId },
        select: { dueAt: true, reps: true },
      },
    },
    orderBy: { order: "asc" },
  });

  const now = new Date();
  const due: { question: (typeof questions)[number]; dueAt: Date }[] = [];
  let nextDueAt: Date | null = null;
  for (const question of questions) {
    const review = question.flashcardReviews[0];
    const dueAt = review?.dueAt ?? new Date(0);
    if (isCardDue(dueAt, now)) {
      due.push({ question, dueAt });
    } else if (!nextDueAt || dueAt < nextDueAt) {
      nextDueAt = dueAt;
    }
  }
  due.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  return {
    cards: due.slice(0, REVIEW_SESSION_LIMIT).map(({ question }) => ({
      questionId: question.id,
      kind: question.kind,
      text: question.text,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        correct: option.isCorrect,
      })),
      expectedAnswer: question.expectedAnswer,
      courseTitle: question.quiz.course.title,
      quizTitle: question.quiz.title,
      reps: question.flashcardReviews[0]?.reps ?? 0,
    })),
    dueCount: due.length,
    totalCards: questions.length,
    nextDueAt: due.length === 0 ? (nextDueAt?.toISOString() ?? null) : null,
  };
}

/** Anzahl aktuell fälliger Karten – für die Dashboard-Begrüßung. */
export async function countDueCards(userId: string): Promise<number> {
  const queue = await getReviewQueue(userId);
  return queue.dueCount;
}

export type FlashcardReviewResult =
  | { ok: true; dueAt: string }
  | { ok: false; error: "not_found" | "not_allowed" };

/**
 * Eine Karte bewerten: Zustand per SM-2 fortschreiben. Erlaubt nur für
 * Fragen aus Prüfungen, die der Nutzer selbst schon versucht hat.
 */
export async function submitFlashcardReview(
  userId: string,
  questionId: string,
  grade: ReviewGrade
): Promise<FlashcardReviewResult> {
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { id: true, quizId: true },
  });
  if (!question) return { ok: false, error: "not_found" };

  const attempted = await db.quizAttempt.findFirst({
    where: { quizId: question.quizId, enrollment: { userId } },
    select: { id: true },
  });
  if (!attempted) return { ok: false, error: "not_allowed" };

  const existing = await db.flashcardReview.findUnique({
    where: { userId_questionId: { userId, questionId } },
    select: { ease: true, intervalDays: true, reps: true, lapses: true },
  });

  const next = reviewFlashcard(existing ?? newCardState(), grade, new Date());
  await db.flashcardReview.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: {
      userId,
      questionId,
      ease: next.ease,
      intervalDays: next.intervalDays,
      reps: next.reps,
      lapses: next.lapses,
      dueAt: next.dueAt,
    },
    update: {
      ease: next.ease,
      intervalDays: next.intervalDays,
      reps: next.reps,
      lapses: next.lapses,
      dueAt: next.dueAt,
    },
  });
  await recordLearnActivity(userId);

  return { ok: true, dueAt: next.dueAt.toISOString() };
}
