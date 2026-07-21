import type { NextRequest } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { listEnrollments } from "@/lib/services/learning-service";

/** "Mein Lernen": Einschreibungen mit Fortschritt und Wiedereinstieg. */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const data = await listEnrollments(
    auth.userId,
    request.nextUrl.searchParams.get("lang")
  );
  return jsonResponse({ data });
}
