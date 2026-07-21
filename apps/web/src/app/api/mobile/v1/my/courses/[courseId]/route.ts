import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { getCourseOutline } from "@/lib/services/learning-service";

/** Kurs-Gliederung für den Player (Abschnitte, Lektionen, Prüfungen). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { courseId } = await params;
  const result = await getCourseOutline(
    auth.userId,
    courseId,
    request.nextUrl.searchParams.get("lang")
  );
  if (!result.ok) {
    return jsonError(result.error, result.error === "not_found" ? 404 : 403);
  }
  return jsonResponse(result.outline);
}
