import type { NextRequest } from "next/server";
import { quizSubmitRequestSchema } from "@elearning/api-contracts/mobile/v1/quiz";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { submitQuizForUser } from "@/lib/services/quiz-service";

const ERROR_STATUS: Record<string, number> = {
  not_found: 404,
  not_enrolled: 403,
  not_eligible: 403,
  time_expired: 409,
  attempt_cooldown: 429,
  attempt_already_passed: 409,
  attempts_exhausted: 429,
};

/** Prüfungs-Abgabe – identische Regeln wie die Web-Server-Action. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await parseJsonBody(request, quizSubmitRequestSchema);
  if (!body.ok) return body.response;

  const { quizId } = await params;
  const result = await submitQuizForUser(auth.userId, {
    quizId,
    answers: body.data.answers,
  });

  if (!result.ok) {
    const status = ERROR_STATUS[result.error ?? ""] ?? 400;
    return jsonResponse(
      {
        error: {
          code: result.error ?? "internal_error",
          ...(result.nextAttemptAt ? { nextAttemptAt: result.nextAttemptAt } : {}),
        },
      },
      status
    );
  }

  return jsonResponse({
    scorePercent: result.scorePercent,
    passed: result.passed,
    certificateSerial: result.certificateSerial ?? null,
    earnedPoints: result.earnedPoints,
    totalPoints: result.totalPoints,
    perQuestion: result.perQuestion,
  });
}
