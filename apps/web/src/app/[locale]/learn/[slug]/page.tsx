import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { courseWatchPercent, isEligibleForExam } from "@elearning/core/progress";
import { sectionLockState, type SectionLockState } from "@elearning/core/drip";
import { canAttemptQuiz } from "@elearning/core/exam-policy";
import { parseTranscriptCues } from "@elearning/core/blocks";
import { courseLanguages } from "@elearning/core/course-i18n";
import { hasSelfTestContent } from "@elearning/core/self-test";
import { parsePositions } from "@elearning/core/media-position";
import { parseChapters } from "@elearning/core/chapters";
import { normalizeHeat } from "@elearning/core/heatmap";
import { parseProvenance } from "@elearning/core/provenance";
import { isBookingConfigured } from "@/lib/termine";
import { LearnView } from "@/components/learn/LearnView";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: { blocks: { orderBy: { order: "asc" } } },
          },
          quiz: {
            select: {
              id: true,
              title: true,
              passPercent: true,
              // für die Anzeige "nächster Versuch möglich ab …"
              maxAttempts: true,
              attemptWindowHours: true,
              retakeAfterPass: true,
            },
          },
        },
      },
      quizzes: {
        where: { kind: "FINAL" },
        select: {
          id: true,
          title: true,
          passPercent: true,
          retakeAfterPass: true,
        },
      },
      creator: {
        select: {
          id: true,
          name: true,
          // termine.lol-Verbindung des Creators (für die Buchungskarte)
          bookingCalendarId: true,
          bookingApiKey: true,
        },
      },
    },
  });
  if (!course) notFound();

  // Einschreibung und eigene Bewertung sind unabhängig → parallel laden
  const [enrollment, myReview] = await Promise.all([
    db.enrollment.findUnique({
      where: {
        userId_courseId: { userId: session!.user.id, courseId: course.id },
      },
      include: {
        lessonProgress: true,
        quizAttempts: {
          select: { quizId: true, passed: true, createdAt: true },
        },
        certificate: { select: { serial: true } },
      },
    }),
    db.review.findUnique({
      where: {
        userId_courseId: { userId: session!.user.id, courseId: course.id },
      },
      select: { rating: true, comment: true },
    }),
  ]);
  if (!enrollment) {
    redirect({
      href: { pathname: "/courses/[slug]", params: { slug } },
      locale,
    });
  }

  const lessons = course.sections.flatMap((s) => s.lessons);
  const progressByLesson = new Map(
    enrollment!.lessonProgress.map((p) => [p.lessonId, p])
  );

  // Heatmap ("Oft geschaut"): aggregierte Zähler aller Medienblöcke laden
  const mediaBlockIds = lessons
    .flatMap((l) => l.blocks)
    .filter((b) => b.type === "VIDEO" || b.type === "AUDIO")
    .map((b) => b.id);
  const watchBuckets =
    mediaBlockIds.length > 0
      ? await db.blockWatchBucket.findMany({
          where: { blockId: { in: mediaBlockIds } },
          select: { blockId: true, bucket: true, views: true },
        })
      : [];
  const heatByBlock = new Map<string, number[] | null>();
  for (const blockId of mediaBlockIds) {
    heatByBlock.set(
      blockId,
      normalizeHeat(watchBuckets.filter((row) => row.blockId === blockId))
    );
  }

  // Letzte Position: nur übernehmen, wenn die Lektion noch im Kurs existiert
  const lastLessonId =
    enrollment!.lastLessonId &&
    lessons.some((l) => l.id === enrollment!.lastLessonId)
      ? enrollment!.lastLessonId
      : null;

  const watchPercent = courseWatchPercent(
    lessons.map((lesson) => ({
      durationSeconds: lesson.durationSeconds,
      watchedSeconds: progressByLesson.get(lesson.id)?.watchedSeconds ?? 0,
    }))
  );

  const sectionQuizzesPassed = course.sections
    .filter((s) => s.quiz)
    .map((s) =>
      enrollment!.quizAttempts.some((a) => a.quizId === s.quiz!.id && a.passed)
    );

  const eligible = isEligibleForExam({
    watchPercent,
    requiredWatchPercent: course.requiredWatchPercent,
    sectionQuizzesPassed,
  });

  // Drip Content: Sperrzustand je Abschnitt (Zeit seit Einschreibung
  // und/oder Zwischenprüfung des vorherigen Abschnitts)
  const now = new Date();
  const lockBySection = new Map<string, SectionLockState>();
  course.sections.forEach((section, index) => {
    const previous = index > 0 ? course.sections[index - 1] : null;
    lockBySection.set(
      section.id,
      sectionLockState(
        {
          dripAfterDays: section.dripAfterDays,
          dripAfterQuiz: section.dripAfterQuiz,
        },
        {
          enrolledAt: enrollment!.createdAt,
          now,
          previousQuizPassed: previous?.quiz
            ? enrollment!.quizAttempts.some(
                (a) => a.quizId === previous.quiz!.id && a.passed
              )
            : null,
        }
      )
    );
  });

  /* Zwischenprüfungen: bestanden? Und falls gesperrt – ab wann wieder?
     Beides fließt in die Lernreise (Ringfarbe und Hinweistext). */
  const quizStateBySection = new Map<
    string,
    { passed: boolean; nextAttemptAt: string | null; exhausted: boolean }
  >();
  for (const section of course.sections) {
    if (!section.quiz) continue;
    const attempts = enrollment!.quizAttempts
      .filter((a) => a.quizId === section.quiz!.id)
      .map((a) => ({ createdAt: a.createdAt, passed: a.passed }));
    const decision = canAttemptQuiz({
      attempts,
      policy: {
        maxAttempts: section.quiz.maxAttempts,
        attemptWindowHours: section.quiz.attemptWindowHours,
        retakeAfterPass: section.quiz.retakeAfterPass,
      },
      now,
    });
    quizStateBySection.set(section.id, {
      passed: attempts.some((a) => a.passed),
      nextAttemptAt:
        !decision.allowed && decision.reason === "cooldown"
          ? decision.nextAttemptAt.toISOString()
          : null,
      exhausted:
        !decision.allowed && decision.reason === "attempts_exhausted",
    });
  }

  const finalQuizRaw = course.quizzes[0] ?? null;
  const finalQuiz = finalQuizRaw
    ? {
        id: finalQuizRaw.id,
        title: finalQuizRaw.title,
        passPercent: finalQuizRaw.passPercent,
        // fürs ExamBand: „Nochmal versuchen" nur wenn Wiederholen erlaubt;
        // der Versuchszähler baut den direkten ?retry=-Link (frische Prüfung)
        retakeAllowed: finalQuizRaw.retakeAfterPass,
        attempts: enrollment!.quizAttempts.filter(
          (attempt) => attempt.quizId === finalQuizRaw.id
        ).length,
      }
    : null;

  return (
    <LearnView
      courseId={course.id}
      lastLessonId={lastLessonId}
      myRating={myReview?.rating ?? null}
      myComment={myReview?.comment ?? null}
      course={{
        slug: course.slug,
        title: course.title,
        language: course.language,
        languages: courseLanguages(course),
        translations: course.translations,
        requiredWatchPercent: course.requiredWatchPercent,
        finalExamRequired: course.finalExamRequired,
        selfTestsEnabled: course.selfTestsEnabled,
        bookingEnabled: isBookingConfigured({
          bookingEnabled: course.bookingEnabled,
          bookingCalendarId: course.creator.bookingCalendarId,
          bookingApiKey: course.creator.bookingApiKey,
        }),
        finalQuiz,
        sections: course.sections.map((s) => {
          const lock = lockBySection.get(s.id)!;
          return {
            id: s.id,
            title: s.title,
            translations: s.translations,
            locked: lock.locked,
            unlocksAt: lock.unlocksAt?.toISOString() ?? null,
            requiresPreviousQuiz: lock.requiresPreviousQuiz,
            quizState: quizStateBySection.get(s.id) ?? null,
            quiz: s.quiz
              ? {
                  id: s.quiz.id,
                  title: s.quiz.title,
                  passed: enrollment!.quizAttempts.some(
                    (a) => a.quizId === s.quiz!.id && a.passed
                  ),
                }
              : null,
            lessons: s.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              translations: l.translations,
              durationSeconds: l.durationSeconds,
              watchedSeconds: progressByLesson.get(l.id)?.watchedSeconds ?? 0,
              completed: progressByLesson.get(l.id)?.completed ?? false,
              positions: parsePositions(progressByLesson.get(l.id)?.positions),
              // "Teste dich" nur anbieten, wenn genug Lernstoff da ist –
              // dieselbe Schwelle wie in der Self-Test-Action
              selfTest: lock.locked
                ? { de: false, en: false }
                : {
                    de: hasSelfTestContent(l.blocks, "de"),
                    en: hasSelfTestContent(l.blocks, "en"),
                  },
              // Inhalte gesperrter Abschnitte werden nie an den Browser
              // gesendet (kein Leak, wie bei Vorschau-Lektionen)
              blocks: lock.locked
                ? []
                : l.blocks.map((b) => ({
                    id: b.id,
                    type: b.type,
                    title: b.title ?? "",
                    url: b.url ?? "",
                    fileName: b.fileName ?? "",
                    content: b.content ?? "",
                    css: b.css ?? "",
                    durationSeconds: b.durationSeconds,
                    transcriptDe: b.transcriptDe ?? "",
                    transcriptEn: b.transcriptEn ?? "",
                    transcriptCues: parseTranscriptCues(b.transcriptCues),
                    poster: b.poster ?? "",
                    chapters: parseChapters(b.chapters),
                    heat: heatByBlock.get(b.id) ?? null,
                    provenance: parseProvenance(b.provenance),
                    translations: b.translations,
                  })),
            })),
          };
        }),
      }}
      watchPercent={watchPercent}
      examEligible={eligible}
      certificateSerial={enrollment!.certificate?.serial ?? null}
      community={{
        viewerId: session!.user.id,
        viewerName: session!.user.name ?? "",
        creatorId: course.creator.id,
        creatorName: course.creator.name ?? "Creator",
      }}
    />
  );
}
