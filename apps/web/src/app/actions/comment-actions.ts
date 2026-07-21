"use server";

import { auth } from "@/auth";
import * as commentService from "@/lib/services/comment-service";
import type { ActionResult } from "./auth-actions";

/**
 * Lektions-Community (Q&A). Logik: lib/services/comment-service
 * (geteilt mit den Mobile-REST-Routen).
 */

export type { LessonCommentDto } from "@/lib/services/comment-service";

/** Alle Kommentare einer Lektion (chronologisch; Baum baut der Client). */
export async function loadLessonComments(
  lessonId: string
): Promise<ActionResult & { comments?: commentService.LessonCommentDto[] }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return commentService.loadComments(
    session.user.id,
    session.user.role ?? "CLIENT",
    lessonId
  );
}

/** Neuen Kommentar bzw. Antwort (bis Ebene 2) posten. */
export async function addLessonComment(input: {
  lessonId: string;
  parentId?: string | null;
  content: string;
}): Promise<ActionResult & { reason?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return commentService.addComment(
    session.user.id,
    session.user.role ?? "CLIENT",
    input
  );
}

/** Löschen: eigener Kommentar oder als Kurs-Creator (Soft-Delete). */
export async function deleteLessonComment(
  commentId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };
  return commentService.deleteComment(
    session.user.id,
    session.user.role ?? "CLIENT",
    commentId
  );
}
