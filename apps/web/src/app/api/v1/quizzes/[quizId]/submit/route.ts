import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authenticateApiRequest, retryAfterHeaders } from "@/lib/api-auth";
import { emailSchema, resolveEnrolledBuyer } from "../../../_lib/headless";
import { submitQuizForUser } from "@/lib/services/quiz-service";

/*
 * Bewusst KEIN CORS/OPTIONS: Dieser Endpoint gehört auf den Server des
 * Integrators – der API-Key darf nie in Browser-Code stehen.
 */

const submitSchema = z.object({
  email: emailSchema,
  answers: z.record(z.string(), z.array(z.string().max(2000)).max(50)),
});

const ERROR_STATUS: Record<string, number> = {
  not_found: 404,
  not_enrolled: 403,
  not_eligible: 403,
  time_expired: 409,
  attempt_cooldown: 429,
  attempt_already_passed: 409,
  attempts_exhausted: 429,
};

/**
 * POST /api/v1/quizzes/[quizId]/submit – Prüfungs-Abgabe für eine
 * eingeschriebene Käufer:in. Bewertung, Versuchsregeln und Zertifikat
 * (bei bestandener Abschlussprüfung: certificateSerial) laufen über
 * denselben Service wie Web und App. Nur für Quizze der eigenen Kurse.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status, headers: retryAfterHeaders(authResult.status) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { quizId } = await params;
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: { courseId: true, course: { select: { creatorId: true } } },
  });
  if (!quiz || quiz.course.creatorId !== authResult.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buyer = await resolveEnrolledBuyer(
    parsed.data.email,
    quiz.courseId,
    authResult.userId
  );
  if (!buyer.ok) {
    return NextResponse.json(
      { error: buyer.error },
      { status: buyer.error === "email_invalid" ? 400 : 403 }
    );
  }

  const result = await submitQuizForUser(buyer.userId, {
    quizId,
    answers: parsed.data.answers,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error ?? "internal_error",
        ...(result.nextAttemptAt ? { nextAttemptAt: result.nextAttemptAt } : {}),
      },
      { status: ERROR_STATUS[result.error ?? ""] ?? 400 }
    );
  }

  return NextResponse.json({
    data: {
      scorePercent: result.scorePercent,
      passed: result.passed,
      certificateSerial: result.certificateSerial ?? null,
      earnedPoints: result.earnedPoints,
      totalPoints: result.totalPoints,
      perQuestion: result.perQuestion,
    },
  });
}
