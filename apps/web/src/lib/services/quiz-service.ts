import { Prisma } from "@prisma/client";
import type {
  AttemptState,
  QuizForAttempt,
} from "@elearning/api-contracts/mobile/v1/quiz";
import { gradeQuiz, hasPassed } from "@elearning/core/grading";
import { courseWatchPercent, isEligibleForExam } from "@elearning/core/progress";
import { makeSerial } from "@elearning/core/certificate/serial";
import { buildCurriculumSnapshot } from "@elearning/core/certificate/curriculum";
import { canAttemptQuiz, type AttemptDecision } from "@elearning/core/exam-policy";
import { isGuaranteeActive } from "@elearning/core/refund";
import { shuffleWithRng } from "@elearning/core/shuffle";
import { gradeFreeTextWithAi } from "@/lib/ai-grading";
import { db } from "@/lib/db";
import { recordLearnActivity } from "@/lib/services/activity-service";
import { sectionLockedForEnrollment } from "@/lib/services/drip-service";

/**
 * Prüfungs-Orchestrierung, geteilt zwischen Web (Server Action / Quiz-Seite)
 * und Mobile-REST-Routen. Regeln (grading, exam-policy, progress) liegen
 * in @elearning/core.
 */

/** Kulanz nach Ablauf des Zeitlimits (Netz/Latenz), wie im Web. */
const TIME_LIMIT_GRACE_MS = 30_000;

export interface QuizSubmission {
  ok: boolean;
  error?: string;
  scorePercent?: number;
  passed?: boolean;
  certificateSerial?: string;
  nextAttemptAt?: string;
  perQuestion?: { questionId: string; correct: boolean; points: number }[];
  earnedPoints?: number;
  totalPoints?: number;
}

function attemptDecisionToError(
  decision: AttemptDecision
): QuizSubmission | null {
  if (decision.allowed) return null;
  if (decision.reason === "cooldown") {
    return {
      ok: false,
      error: "attempt_cooldown",
      nextAttemptAt: decision.nextAttemptAt.toISOString(),
    };
  }
  return {
    ok: false,
    error:
      decision.reason === "already_passed"
        ? "attempt_already_passed"
        : "attempts_exhausted",
  };
}

export type QuizForAttemptResult =
  | { ok: true; data: QuizForAttempt }
  | { ok: false; error: "not_found" | "not_enrolled" };

/**
 * Prüfung zum Bearbeiten laden: Fragen ohne Lösungen, optional gemischt;
 * bei Zeitlimit startet (bzw. läuft) die serverseitige Uhr.
 */
export async function getQuizForAttempt(
  userId: string,
  quizId: string
): Promise<QuizForAttemptResult> {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { include: { options: true }, orderBy: { order: "asc" } },
    },
  });
  if (!quiz) return { ok: false, error: "not_found" };

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: quiz.courseId } },
    include: { quizAttempts: { where: { quizId } } },
  });
  if (!enrollment) return { ok: false, error: "not_enrolled" };

  // Drip: Fragen eines gesperrten Abschnitts werden gar nicht ausgeliefert
  if (
    quiz.sectionId &&
    (await sectionLockedForEnrollment(quiz.sectionId, enrollment))
  ) {
    return { ok: false, error: "not_found" };
  }

  const now = new Date();
  const decision = canAttemptQuiz({
    attempts: enrollment.quizAttempts.map((a) => ({
      createdAt: a.createdAt,
      passed: a.passed,
    })),
    policy: {
      maxAttempts: quiz.maxAttempts,
      attemptWindowHours: quiz.attemptWindowHours,
      retakeAfterPass: quiz.retakeAfterPass,
    },
    now,
  });
  const attempt: AttemptState = {
    allowed: decision.allowed,
    reason: decision.allowed ? null : decision.reason,
    nextAttemptAt:
      !decision.allowed && decision.reason === "cooldown"
        ? decision.nextAttemptAt.toISOString()
        : null,
    attemptsUsed: enrollment.quizAttempts.length,
    maxAttempts: quiz.maxAttempts,
  };

  // Zeitlimit: Uhr startet beim ersten Öffnen; eine abgelaufene Uhr wird
  // verworfen, der nächste Versuch startet frisch (wie die Web-Quiz-Seite)
  let remainingSeconds: number | null = null;
  if (quiz.timeLimitMinutes && decision.allowed) {
    const key = { enrollmentId: enrollment.id, quizId: quiz.id };
    let timer = await db.quizTimer.findUnique({
      where: { enrollmentId_quizId: key },
    });
    const limitMs = quiz.timeLimitMinutes * 60_000;
    if (timer && now.getTime() > timer.startedAt.getTime() + limitMs + TIME_LIMIT_GRACE_MS) {
      await db.quizTimer.delete({ where: { id: timer.id } });
      timer = null;
    }
    if (!timer) {
      timer = await db.quizTimer.create({ data: key });
    }
    remainingSeconds = Math.max(
      0,
      Math.floor((timer.startedAt.getTime() + limitMs - now.getTime()) / 1000)
    );
  }

  const questions = quiz.shuffleQuestions
    ? shuffleWithRng(quiz.questions, Math.random)
    : quiz.questions;

  return {
    ok: true,
    data: {
      quiz: {
        id: quiz.id,
        courseId: quiz.courseId,
        kind: quiz.kind,
        title: quiz.title,
        passPercent: quiz.passPercent,
        timeLimitMinutes: quiz.timeLimitMinutes,
        remainingSeconds,
      },
      attempt,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        kind: q.kind,
        points: q.points,
        options: (quiz.shuffleAnswers
          ? shuffleWithRng(q.options, Math.random)
          : q.options
        ).map((o) => ({ id: o.id, text: o.text })),
      })),
    },
  };
}

/** Abgabe bewerten – identische Semantik wie die bisherige Server Action. */
export async function submitQuizForUser(
  userId: string,
  input: { quizId: string; answers: Record<string, string[]> }
): Promise<QuizSubmission> {
  const quiz = await db.quiz.findUnique({
    where: { id: input.quizId },
    include: {
      questions: { include: { options: true }, orderBy: { order: "asc" } },
      course: {
        include: {
          sections: {
            include: {
              lessons: true,
              quiz: { select: { id: true, passPercent: true } },
            },
          },
        },
      },
    },
  });
  if (!quiz) return { ok: false, error: "not_found" };

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: quiz.courseId } },
    include: { lessonProgress: true, quizAttempts: true, certificate: true },
  });
  if (!enrollment) return { ok: false, error: "not_enrolled" };

  // Drip Content: Zwischenprüfung eines gesperrten Abschnitts nicht werten
  if (
    quiz.sectionId &&
    (await sectionLockedForEnrollment(quiz.sectionId, enrollment))
  ) {
    return { ok: false, error: "section_locked" };
  }

  // Zeitlimit serverseitig durchsetzen: Die Uhr startete beim Öffnen der
  // Prüfung; nach Ablauf (+30 s Kulanz für Netz/Latenz) zählt die Abgabe
  // nicht – der Timer wird gelöscht, ein neuer Versuch startet frisch.
  if (quiz.timeLimitMinutes) {
    const timer = await db.quizTimer.findUnique({
      where: {
        enrollmentId_quizId: {
          enrollmentId: enrollment.id,
          quizId: quiz.id,
        },
      },
    });
    if (timer) {
      const deadline =
        timer.startedAt.getTime() +
        quiz.timeLimitMinutes * 60_000 +
        TIME_LIMIT_GRACE_MS;
      if (Date.now() > deadline) {
        await db.quizTimer.delete({ where: { id: timer.id } });
        return { ok: false, error: "time_expired" };
      }
    }
  }

  // Wiederholungsregeln des Creators durchsetzen
  const decision = canAttemptQuiz({
    attempts: enrollment.quizAttempts
      .filter((a) => a.quizId === quiz.id)
      .map((a) => ({ createdAt: a.createdAt, passed: a.passed })),
    policy: {
      maxAttempts: quiz.maxAttempts,
      attemptWindowHours: quiz.attemptWindowHours,
      retakeAfterPass: quiz.retakeAfterPass,
    },
    now: new Date(),
  });
  const blocked = attemptDecisionToError(decision);
  if (blocked) return blocked;

  // Für die Abschlussprüfung: Zulassung prüfen
  if (quiz.kind === "FINAL") {
    // Solange die 30-Tage-Rückgabegarantie läuft, gibt es keine Prüfung
    // (und damit kein Zertifikat) – außer der Nutzer hat die Garantie
    // freiwillig vorzeitig beendet
    if (isGuaranteeActive(enrollment)) {
      return { ok: false, error: "guarantee_active" };
    }
    const lessons = quiz.course.sections.flatMap((s) => s.lessons);
    const watchPercent = courseWatchPercent(
      lessons.map((lesson) => ({
        durationSeconds: lesson.durationSeconds,
        watchedSeconds:
          enrollment.lessonProgress.find((p) => p.lessonId === lesson.id)
            ?.watchedSeconds ?? 0,
      }))
    );
    const sectionQuizzesPassed = quiz.course.sections
      .filter((s) => s.quiz)
      .map((s) =>
        enrollment.quizAttempts.some((a) => a.quizId === s.quiz!.id && a.passed)
      );
    const eligible = isEligibleForExam({
      watchPercent,
      requiredWatchPercent: quiz.course.requiredWatchPercent,
      sectionQuizzesPassed,
    });
    if (!eligible) {
      return { ok: false, error: "not_eligible" };
    }
  }

  // Antworten serverseitig normalisieren: Freitext auf 2000 Zeichen begrenzen,
  // nur Strings zulassen – der Client bestimmt nie mehr als den Antworttext.
  const answers: Record<string, string[]> = {};
  for (const q of quiz.questions) {
    const given = (input.answers[q.id] ?? []).filter(
      (v) => typeof v === "string"
    );
    answers[q.id] =
      q.kind === "FREE_TEXT" ? [(given[0] ?? "").slice(0, 2000)] : given;
  }

  // KI-Bewertung für Freitext (Batch); ohne Urteil greift der exakte Vergleich
  const aiItems = quiz.questions
    .filter(
      (q) =>
        q.kind === "FREE_TEXT" && q.aiGraded && (answers[q.id][0] ?? "").trim()
    )
    .map((q) => ({
      questionId: q.id,
      question: q.text,
      expectedAnswer: q.expectedAnswer ?? "",
      answer: answers[q.id][0],
    }));
  const aiVerdicts =
    aiItems.length > 0
      ? await gradeFreeTextWithAi(aiItems, {
          userId: enrollment.userId,
          courseId: quiz.courseId,
        })
      : {};

  const result = gradeQuiz(
    quiz.questions.map((q) => ({
      id: q.id,
      kind: q.kind,
      points: q.points,
      expectedAnswer: q.expectedAnswer,
      aiGraded: q.aiGraded,
      options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
    })),
    answers,
    aiVerdicts
  );
  const passed = hasPassed(result.scorePercent, quiz.passPercent);

  await db.quizAttempt.create({
    data: {
      quizId: quiz.id,
      enrollmentId: enrollment.id,
      scorePercent: result.scorePercent,
      passed,
      answers: input.answers,
    },
  });

  // Prüfungs-Uhr entfernen – der nächste Versuch startet mit frischem Limit
  await db.quizTimer.deleteMany({
    where: { enrollmentId: enrollment.id, quizId: quiz.id },
  });
  await recordLearnActivity(userId);

  let certificateSerial: string | undefined;
  if (quiz.kind === "FINAL" && passed) {
    if (enrollment.certificate) {
      certificateSerial = enrollment.certificate.serial;
    } else {
      // Kursinhalt zum Ausstellungszeitpunkt einfrieren – die öffentliche
      // Verifikations-Seite zeigt den Stand des Abschlusses, nicht den
      // (später womöglich geänderten) aktuellen Kurs
      const curriculum = buildCurriculumSnapshot(
        quiz.course.sections.map((section) => ({
          title: section.title,
          order: section.order,
          lessons: section.lessons.map((lesson) => ({
            title: lesson.title,
            order: lesson.order,
          })),
        }))
      );
      const certificate = await db.certificate.create({
        data: {
          enrollmentId: enrollment.id,
          serial: makeSerial(),
          scorePercent: result.scorePercent,
          curriculum: curriculum as unknown as Prisma.InputJsonValue,
        },
      });
      await db.enrollment.update({
        where: { id: enrollment.id },
        data: { completedAt: new Date() },
      });
      certificateSerial = certificate.serial;
    }
  }

  return {
    ok: true,
    scorePercent: result.scorePercent,
    passed,
    certificateSerial,
    perQuestion: result.perQuestion,
    earnedPoints: result.earnedPoints,
    totalPoints: result.totalPoints,
  };
}
