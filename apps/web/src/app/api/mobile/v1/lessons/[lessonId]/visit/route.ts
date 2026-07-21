import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { markLessonVisited } from "@/lib/services/progress-service";

/** Zuletzt geöffnete Lektion vermerken (Wiedereinstieg). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { lessonId } = await params;
  const result = await markLessonVisited(auth.userId, lessonId);
  if (!result.ok) return jsonError("not_found", 404);
  return jsonResponse({ ok: true });
}
