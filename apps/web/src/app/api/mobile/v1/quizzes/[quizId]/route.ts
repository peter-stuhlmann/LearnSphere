import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { getQuizForAttempt } from "@/lib/services/quiz-service";

/** Prüfung laden (Fragen ohne Lösungen; startet ggf. die Prüfungs-Uhr). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { quizId } = await params;
  const result = await getQuizForAttempt(auth.userId, quizId);
  if (!result.ok) {
    return jsonError(result.error, result.error === "not_found" ? 404 : 403);
  }
  return jsonResponse(result.data);
}
