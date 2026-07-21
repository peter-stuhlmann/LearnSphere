import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Persönliche Lektions-Notizen (nur für den Verfasser sichtbar), geteilt
 * zwischen Server Actions (Web) und Mobile-REST-Routen.
 */

const noteContentSchema = z.string().trim().min(1).max(4000);

export interface LessonNoteDto {
  id: string;
  blockId: string | null;
  timeSeconds: number | null;
  content: string;
  createdAt: string;
}

export type NotesResult =
  | { ok: true; notes: LessonNoteDto[] }
  | { ok: false; error: string };

function toDto(row: {
  id: string;
  blockId: string | null;
  timeSeconds: number | null;
  content: string;
  createdAt: Date;
}): LessonNoteDto {
  return {
    id: row.id,
    blockId: row.blockId,
    timeSeconds: row.timeSeconds,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Zugriff: eingeschrieben oder Creator des Kurses. */
async function canAccessLesson(userId: string, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      section: {
        select: { course: { select: { id: true, creatorId: true } } },
      },
    },
  });
  if (!lesson) return false;
  if (lesson.section.course.creatorId === userId) return true;
  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId: lesson.section.course.id },
    },
    select: { id: true },
  });
  return Boolean(enrollment);
}

export async function listNotes(
  userId: string,
  lessonId: string
): Promise<NotesResult> {
  const rows = await db.lessonNote.findMany({
    where: { userId, lessonId },
    orderBy: [{ timeSeconds: "asc" }, { createdAt: "asc" }],
  });
  return { ok: true, notes: rows.map(toDto) };
}

export async function addNote(
  userId: string,
  input: {
    lessonId: string;
    content: string;
    blockId?: string | null;
    timeSeconds?: number | null;
  }
): Promise<NotesResult> {
  const content = noteContentSchema.safeParse(input.content);
  if (!content.success) return { ok: false, error: "note_invalid" };
  if (!(await canAccessLesson(userId, input.lessonId))) {
    return { ok: false, error: "not_enrolled" };
  }

  const note = await db.lessonNote.create({
    data: {
      userId,
      lessonId: input.lessonId,
      blockId: input.blockId ?? null,
      timeSeconds:
        typeof input.timeSeconds === "number" && input.timeSeconds >= 0
          ? Math.floor(input.timeSeconds)
          : null,
      content: content.data,
    },
  });
  return { ok: true, notes: [toDto(note)] };
}

export async function updateNote(
  userId: string,
  noteId: string,
  rawContent: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const content = noteContentSchema.safeParse(rawContent);
  if (!content.success) return { ok: false, error: "note_invalid" };

  // updateMany mit userId-Filter: fremde Notizen sind unerreichbar
  const result = await db.lessonNote.updateMany({
    where: { id: noteId, userId },
    data: { content: content.data },
  });
  return result.count > 0 ? { ok: true } : { ok: false, error: "not_found" };
}

export async function deleteNote(
  userId: string,
  noteId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await db.lessonNote.deleteMany({
    where: { id: noteId, userId },
  });
  return result.count > 0 ? { ok: true } : { ok: false, error: "not_found" };
}
