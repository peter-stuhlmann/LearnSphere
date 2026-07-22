import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAttemptQuiz } from "@elearning/core/exam-policy";
import {
  courseWatchPercent,
  isEligibleForExam,
} from "@elearning/core/progress";
import { isGuaranteeActive } from "@elearning/core/refund";
import { shuffleWithRng } from "@elearning/core/shuffle";
import { QuizView, type AttemptState } from "@/components/learn/QuizView";

/**
 * Prüfungs-Uhr laden bzw. starten und Restzeit liefern. Eine ohne Abgabe
 * abgelaufene Uhr wird verworfen – der neue Versuch bekommt ein frisches
 * Limit. (Modul-Level wegen der Purity-Regeln des React-Compilers.)
 */
async function ensureQuizTimer(
  enrollmentId: string,
  quizId: string,
  limitMinutes: number
): Promise<number> {
  const key = { enrollmentId, quizId };
  let timer = await db.quizTimer.findUnique({
    where: { enrollmentId_quizId: key },
  });
  if (
    timer &&
    Date.now() - timer.startedAt.getTime() >= limitMinutes * 60_000
  ) {
    await db.quizTimer.delete({ where: { id: timer.id } });
    timer = null;
  }
  if (!timer) {
    timer = await db.quizTimer.create({ data: key });
  }
  return Math.max(
    1,
    Math.round(
      limitMinutes * 60 - (Date.now() - timer.startedAt.getTime()) / 1000
    )
  );
}

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string; quizId: string }>;
  searchParams: Promise<{ retry?: string }>;
}) {
  const { locale, slug, quizId } = await params;
  const { retry } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          requiredWatchPercent: true,
          // für die Zulassungsprüfung der Abschlussprüfung
          sections: {
            select: {
              lessons: { select: { id: true, durationSeconds: true } },
              quiz: { select: { id: true } },
            },
          },
        },
      },
      questions: {
        orderBy: { order: "asc" },
        include: {
          // isCorrect wird bewusst NICHT an den Client gegeben
          options: {
            orderBy: { order: "asc" },
            select: { id: true, text: true },
          },
        },
      },
    },
  });
  if (!quiz || quiz.course.slug !== slug) notFound();

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session!.user.id, courseId: quiz.course.id },
    },
    include: {
      // ALLE Versuche (auch der Zwischenprüfungen – für die Zulassung)
      quizAttempts: {
        orderBy: { createdAt: "asc" },
        select: {
          quizId: true,
          createdAt: true,
          passed: true,
          scorePercent: true,
        },
      },
      certificate: { select: { serial: true } },
      lessonProgress: { select: { lessonId: true, watchedSeconds: true } },
    },
  });
  if (!enrollment) {
    redirect({
      href: { pathname: "/courses/[slug]", params: { slug } },
      locale,
    });
  }

  // Bestandene Prüfung bleibt bestanden: Der Ergebnis-Screen des letzten
  // Versuchs übersteht Reloads. Erst „Nochmal versuchen" (?retry=<Anzahl>)
  // fordert bewusst eine frisch generierte Prüfung an – der Token ist an den
  // Versuchszähler gebunden und wird mit dem nächsten Versuch ungültig.
  const attempts = enrollment!.quizAttempts.filter(
    (attempt) => attempt.quizId === quiz.id
  );
  const latestAttempt = attempts[attempts.length - 1] ?? null;
  const freshRequested = retry === String(attempts.length);
  const showPersistedResult = Boolean(latestAttempt?.passed) && !freshRequested;

  const decision = canAttemptQuiz({
    attempts,
    policy: {
      maxAttempts: quiz.maxAttempts,
      attemptWindowHours: quiz.attemptWindowHours,
      retakeAfterPass: quiz.retakeAfterPass,
    },
    now: new Date(),
  });

  // 30-Tage-Rückgabegarantie sperrt die ABSCHLUSSprüfung (kein Zertifikat
  // im Rückgabefenster); der Nutzer kann die Garantie freiwillig beenden
  const guaranteeBlocked =
    quiz.kind === "FINAL" && isGuaranteeActive(enrollment!);

  // Zulassung zur Abschlussprüfung: Sehquote + bestandene Zwischenprüfungen
  // (gleiche Regel wie beim Submit in quiz-service)
  let notEligible = false;
  if (quiz.kind === "FINAL" && !showPersistedResult) {
    const lessons = quiz.course.sections.flatMap((s) => s.lessons);
    const watchPercent = courseWatchPercent(
      lessons.map((lesson) => ({
        durationSeconds: lesson.durationSeconds,
        watchedSeconds:
          enrollment!.lessonProgress.find((p) => p.lessonId === lesson.id)
            ?.watchedSeconds ?? 0,
      }))
    );
    const sectionQuizzesPassed = quiz.course.sections
      .filter((s) => s.quiz)
      .map((s) =>
        enrollment!.quizAttempts.some(
          (a) => a.quizId === s.quiz!.id && a.passed
        )
      );
    notEligible = !isEligibleForExam({
      watchPercent,
      requiredWatchPercent: quiz.course.requiredWatchPercent,
      sectionQuizzesPassed,
    });
  }

  const attemptState: AttemptState = guaranteeBlocked
    ? {
        blocked: "guarantee",
        guaranteeUntil: enrollment!.refundableUntil?.toISOString() ?? null,
        usedAttempts: attempts.length,
        maxAttempts: quiz.maxAttempts,
      }
    : notEligible
      ? {
          blocked: "not_eligible",
          requiredWatchPercent: quiz.course.requiredWatchPercent,
          usedAttempts: attempts.length,
          maxAttempts: quiz.maxAttempts,
        }
      : decision.allowed
        ? {
            blocked: null,
            usedAttempts: attempts.length,
            maxAttempts: quiz.maxAttempts,
          }
        : {
            blocked: decision.reason,
            nextAttemptAt:
              decision.reason === "cooldown"
                ? decision.nextAttemptAt.toISOString()
                : null,
            usedAttempts: attempts.length,
            maxAttempts: quiz.maxAttempts,
          };

  // Misch-Optionen des Creators: pro Aufruf neu gemischt (serverseitig)
  const orderedQuestions = quiz.shuffleQuestions
    ? shuffleWithRng(quiz.questions, Math.random)
    : quiz.questions;

  // Zeitlimit: Uhr startet beim ersten Öffnen (überlebt Reloads) – aber
  // nicht, solange nur der gespeicherte Ergebnis-Screen gezeigt wird
  const remainingSeconds =
    quiz.timeLimitMinutes &&
    decision.allowed &&
    !guaranteeBlocked &&
    !notEligible &&
    !showPersistedResult
      ? await ensureQuizTimer(
          enrollment!.id,
          quiz.id,
          quiz.timeLimitMinutes
        )
      : null;

  return (
    <QuizView
      // Nach jeder Abgabe bzw. beim Wechsel Ergebnis→neue Prüfung remounten:
      // der neue Versuch bekommt frische Mischung, neuen Timer, leere Antworten
      key={`${attempts.length}-${showPersistedResult ? "result" : "quiz"}-${guaranteeBlocked ? "guard" : "open"}`}
      attemptState={attemptState}
      remainingSeconds={remainingSeconds}
      initialResult={
        showPersistedResult && latestAttempt
          ? {
              scorePercent: latestAttempt.scorePercent,
              certificateSerial:
                quiz.kind === "FINAL"
                  ? (enrollment!.certificate?.serial ?? null)
                  : null,
            }
          : null
      }
      canRetry={decision.allowed}
      quiz={{
        id: quiz.id,
        title: quiz.title,
        kind: quiz.kind,
        passPercent: quiz.passPercent,
        courseId: quiz.course.id,
        courseSlug: quiz.course.slug,
        courseTitle: quiz.course.title,
        questions: orderedQuestions.map((q) => ({
          id: q.id,
          text: q.text,
          kind: q.kind,
          points: q.points,
          options:
            quiz.shuffleAnswers && q.kind !== "FREE_TEXT"
              ? shuffleWithRng(q.options, Math.random)
              : q.options,
        })),
      }}
    />
  );
}
