import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { getLessonForUser } from "@/lib/services/learning-service";

/** Lektion mit aufgelösten Blöcken und signierten Medien-URLs. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { lessonId } = await params;
  const result = await getLessonForUser(
    auth.userId,
    lessonId,
    request.nextUrl.searchParams.get("lang")
  );
  if (!result.ok) {
    return jsonError(result.error, result.error === "not_found" ? 404 : 403);
  }
  return jsonResponse(result.detail);
}
