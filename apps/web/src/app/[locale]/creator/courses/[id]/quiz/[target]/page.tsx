import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { QuizEditor } from "@/components/dashboard/QuizEditor";

export default async function QuizEditorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; target: string }>;
}) {
  const { locale, id, target } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
  }

  const course = await db.course.findUnique({
    where: { id },
    select: { id: true, title: true, creatorId: true },
  });
  if (!course || course.creatorId !== session!.user.id) {
    notFound();
  }

  const isFinal = target === "final";
  let sectionTitle: string | null = null;

  if (!isFinal) {
    const section = await db.section.findUnique({ where: { id: target } });
    if (!section || section.courseId !== id) {
      notFound();
    }
    sectionTitle = section.title;
  }

  const quiz = await db.quiz.findFirst({
    where: isFinal ? { courseId: id, kind: "FINAL" } : { sectionId: target },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });

  return (
    <QuizEditor
      courseId={course.id}
      courseTitle={course.title}
      sectionId={isFinal ? null : target}
      sectionTitle={sectionTitle}
      quizId={quiz?.id ?? null}
      initial={
        quiz
          ? {
              title: quiz.title,
              passPercent: quiz.passPercent,
              maxAttempts: quiz.maxAttempts,
              attemptWindowHours: quiz.attemptWindowHours,
              retakeAfterPass: quiz.retakeAfterPass,
              shuffleQuestions: quiz.shuffleQuestions,
              shuffleAnswers: quiz.shuffleAnswers,
              timeLimitMinutes: quiz.timeLimitMinutes,
              questions: quiz.questions.map((q) => ({
                text: q.text,
                kind: q.kind,
                points: q.points,
                expectedAnswer: q.expectedAnswer ?? "",
                aiGraded: q.aiGraded,
                options: q.options.map((o) => ({
                  text: o.text,
                  isCorrect: o.isCorrect,
                })),
              })),
            }
          : null
      }
    />
  );
}
