import type { NextRequest } from "next/server";
import { addNoteRequestSchema } from "@elearning/api-contracts/mobile/v1/community";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { addNote, listNotes } from "@/lib/services/note-service";

/** Persönliche Notizen der Lektion (nur eigene). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { lessonId } = await params;
  const result = await listNotes(auth.userId, lessonId);
  if (!result.ok) return jsonError("not_found", 404);
  return jsonResponse({ data: result.notes });
}

/** Notiz anlegen (optional mit Block + Zeitstempel). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await parseJsonBody(request, addNoteRequestSchema);
  if (!body.ok) return body.response;

  const { lessonId } = await params;
  const result = await addNote(auth.userId, { lessonId, ...body.data });
  if (!result.ok) {
    return jsonError(
      result.error === "not_enrolled" ? "not_enrolled" : "validation_failed",
      result.error === "not_enrolled" ? 403 : 400
    );
  }
  return jsonResponse({ data: result.notes }, 201);
}
