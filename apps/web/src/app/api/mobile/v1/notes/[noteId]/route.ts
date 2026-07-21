import type { NextRequest } from "next/server";
import { updateNoteRequestSchema } from "@elearning/api-contracts/mobile/v1/community";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { jsonError, jsonResponse, parseJsonBody } from "@/lib/mobile/http";
import { deleteNote, updateNote } from "@/lib/services/note-service";

/** Eigene Notiz bearbeiten. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await parseJsonBody(request, updateNoteRequestSchema);
  if (!body.ok) return body.response;

  const { noteId } = await params;
  const result = await updateNote(auth.userId, noteId, body.data.content);
  if (!result.ok) return jsonError("not_found", 404);
  return jsonResponse({ ok: true });
}

/** Eigene Notiz löschen. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { noteId } = await params;
  const result = await deleteNote(auth.userId, noteId);
  if (!result.ok) return jsonError("not_found", 404);
  return jsonResponse({ ok: true });
}
