"use server";

import { auth } from "@/auth";
import * as noteService from "@/lib/services/note-service";
import type { ActionResult } from "./auth-actions";

/**
 * Persönliche Lektions-Notizen: nur für den Verfasser sichtbar, optional
 * mit Zeitstempel in einem Medienblock ("Notiz bei 4:32" → Klick springt
 * im Player dorthin). Logik: lib/services/note-service (geteilt mit Mobile).
 */

export type { LessonNoteDto } from "@/lib/services/note-service";

export interface NotesResult extends ActionResult {
  notes?: noteService.LessonNoteDto[];
}

export async function listLessonNotes(
  lessonId: string
): Promise<NotesResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return noteService.listNotes(session.user.id, lessonId);
}

export async function addLessonNote(input: {
  lessonId: string;
  content: string;
  blockId?: string | null;
  timeSeconds?: number | null;
}): Promise<NotesResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return noteService.addNote(session.user.id, input);
}

export async function updateLessonNote(input: {
  noteId: string;
  content: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return noteService.updateNote(session.user.id, input.noteId, input.content);
}

export async function deleteLessonNote(noteId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return noteService.deleteNote(session.user.id, noteId);
}
