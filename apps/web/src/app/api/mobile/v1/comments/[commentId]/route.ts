import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { deleteComment } from "@/lib/services/comment-service";

/** Kommentar löschen (eigener, als Kurs-Creator oder Admin; Soft-Delete). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { commentId } = await params;
  const result = await deleteComment(auth.userId, auth.role, commentId);
  if (!result.ok) {
    return jsonError(
      result.error === "not_found" ? "not_found" : "unauthorized",
      result.error === "not_found" ? 404 : 403
    );
  }
  return jsonResponse({ ok: true });
}
