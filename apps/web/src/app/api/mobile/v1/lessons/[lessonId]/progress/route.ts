import type { NextRequest } from "next/server";
import { progressUpdateSchema } from "@elearning/api-contracts/mobile/v1/learning";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import {
  resetLessonProgress,
  updateLessonProgress,
} from "@/lib/services/progress-service";

/** Sehfortschritt melden (monotone Zusammenführung wie im Web). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await parseJsonBody(request, progressUpdateSchema);
  if (!body.ok) return body.response;

  const { lessonId } = await params;
  const result = await updateLessonProgress(auth.userId, {
    lessonId,
    ...body.data,
  });
  if (!result.ok) {
    return jsonError(
      result.error === "not_enrolled" ? "not_enrolled" : "not_found",
      result.error === "not_enrolled" ? 403 : 404
    );
  }
  return jsonResponse({ ok: true });
}

/** Lektion auf "nicht erledigt" zurücksetzen. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { lessonId } = await params;
  const result = await resetLessonProgress(auth.userId, lessonId);
  if (!result.ok) {
    return jsonError(
      result.error === "not_enrolled" ? "not_enrolled" : "not_found",
      result.error === "not_enrolled" ? 403 : 404
    );
  }
  return jsonResponse({ ok: true });
}
