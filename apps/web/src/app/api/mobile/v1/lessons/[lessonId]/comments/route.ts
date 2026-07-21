import type { NextRequest } from "next/server";
import { addCommentRequestSchema } from "@elearning/api-contracts/mobile/v1/community";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { addComment, loadComments } from "@/lib/services/comment-service";

/** Community-Kommentare der Lektion (chronologisch; Baum baut der Client). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { lessonId } = await params;
  const result = await loadComments(auth.userId, auth.role, lessonId);
  if (!result.ok) return jsonError("unauthorized", 403);
  return jsonResponse({ data: result.comments });
}

/** Kommentar/Antwort posten (Sanitizing + Moderation wie im Web). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await parseJsonBody(request, addCommentRequestSchema);
  if (!body.ok) return body.response;

  const { lessonId } = await params;
  const result = await addComment(auth.userId, auth.role, {
    lessonId,
    ...body.data,
  });
  if (!result.ok) {
    const status =
      result.error === "unauthorized"
        ? 403
        : result.error === "too_many_attempts"
          ? 429
          : 400;
    return jsonResponse({ error: { code: result.error } }, status);
  }
  return jsonResponse({ ok: true }, 201);
}
