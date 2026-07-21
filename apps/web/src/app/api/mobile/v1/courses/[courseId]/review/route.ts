import type { NextRequest } from "next/server";
import { reviewRequestSchema } from "@elearning/api-contracts/mobile/v1/community";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import {
  getOwnReview,
  saveComment,
  upsertRating,
} from "@/lib/services/review-service";

/** Eigene Bewertung lesen (Sterne vorbelegen). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { courseId } = await params;
  const review = await getOwnReview(auth.userId, courseId);
  return jsonResponse({ review });
}

/** Bewertung setzen/aktualisieren (Sterne + optionaler Text). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await parseJsonBody(request, reviewRequestSchema);
  if (!body.ok) return body.response;

  const { courseId } = await params;
  const rated = await upsertRating(auth.userId, courseId, body.data.rating);
  if (!rated.ok) {
    return jsonResponse(
      { error: { code: rated.error } },
      rated.error === "not_enrolled" ? 403 : 400
    );
  }
  if (body.data.comment !== undefined) {
    const saved = await saveComment(auth.userId, courseId, body.data.comment);
    if (!saved.ok) {
      return jsonResponse({ error: { code: saved.error } }, 400);
    }
  }
  return jsonResponse({ ok: true });
}
