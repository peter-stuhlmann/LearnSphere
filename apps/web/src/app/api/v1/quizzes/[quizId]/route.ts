import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiRequest, retryAfterHeaders } from "@/lib/api-auth";
import { resolveEnrolledBuyer } from "../../_lib/headless";
import { getQuizForAttempt } from "@/lib/services/quiz-service";

/*
 * Bewusst KEIN CORS/OPTIONS: Dieser Endpoint gehört auf den Server des
 * Integrators – der API-Key darf nie in Browser-Code stehen.
 */

/**
 * GET /api/v1/quizzes/[quizId]?email=… – Prüfung für eine eingeschriebene
 * Käufer:in laden: Fragen OHNE Lösungen, plus Versuchs-Status (Cooldown,
 * bereits bestanden, Restzeit). Startet ggf. die Prüfungs-Uhr – gleiche
 * Regeln wie Web und App. Nur für Quizze der eigenen Kurse.
 */
export async function GET(
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

  const { quizId } = await params;
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: { courseId: true, course: { select: { creatorId: true } } },
  });
  if (!quiz || quiz.course.creatorId !== authResult.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buyer = await resolveEnrolledBuyer(
    request.nextUrl.searchParams.get("email"),
    quiz.courseId,
    authResult.userId
  );
  if (!buyer.ok) {
    return NextResponse.json(
      { error: buyer.error },
      { status: buyer.error === "email_invalid" ? 400 : 403 }
    );
  }

  const result = await getQuizForAttempt(buyer.userId, quizId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "not_found" ? 404 : 403 }
    );
  }
  return NextResponse.json(
    { data: result.data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
