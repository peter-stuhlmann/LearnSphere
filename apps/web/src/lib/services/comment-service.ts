import { db } from "@/lib/db";
import { sanitizeRichText } from "@/lib/sanitize";
import { checkRateLimit } from "@/lib/rate-limit";
import { isModerationEnabled, moderateEditorialText } from "@/lib/moderation";

/**
 * Lektions-Community (Q&A), geteilt zwischen Web-Actions und Mobile-Routen.
 * Zugriff: eingeschrieben, Kurs-Creator oder Admin.
 */

/** Kommentare verschachteln bis Ebene 2 (= 3 Ebenen: 0, 1, 2). */
const MAX_DEPTH = 2;
const MAX_CONTENT_LENGTH = 20_000;

export interface LessonCommentDto {
  id: string;
  parentId: string | null;
  depth: number;
  userId: string;
  userName: string;
  userImage: string | null;
  isCreator: boolean;
  content: string;
  deleted: boolean;
  createdAt: string;
}

async function communityAccess(
  userId: string,
  role: string,
  lessonId: string
) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      section: { select: { course: { select: { id: true, creatorId: true } } } },
    },
  });
  if (!lesson) return null;
  const course = lesson.section.course;

  if (course.creatorId !== userId && role !== "ADMIN") {
    const enrollment = await db.enrollment.findFirst({
      where: { userId, courseId: course.id },
      select: { id: true },
    });
    if (!enrollment) return null;
  }
  return { userId, creatorId: course.creatorId };
}

export type CommentsResult =
  | { ok: true; comments: LessonCommentDto[] }
  | { ok: false; error: string };

/** Alle Kommentare einer Lektion (chronologisch; Baum baut der Client). */
export async function loadComments(
  userId: string,
  role: string,
  lessonId: string
): Promise<CommentsResult> {
  const access = await communityAccess(userId, role, lessonId);
  if (!access) return { ok: false, error: "unauthorized" };

  const comments = await db.lessonComment.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      parentId: true,
      depth: true,
      userId: true,
      content: true,
      deletedAt: true,
      createdAt: true,
      user: { select: { name: true, image: true } },
    },
  });

  return {
    ok: true,
    comments: comments.map((comment) => ({
      id: comment.id,
      parentId: comment.parentId,
      depth: comment.depth,
      userId: comment.userId,
      userName: comment.user.name ?? "…",
      userImage: comment.user.image,
      isCreator: comment.userId === access.creatorId,
      // gelöschte Kommentare bleiben als Platzhalter im Thread
      content: comment.deletedAt ? "" : comment.content,
      deleted: Boolean(comment.deletedAt),
      createdAt: comment.createdAt.toISOString(),
    })),
  };
}

export type AddCommentResult =
  | { ok: true }
  | { ok: false; error: string; reason?: string };

/** Neuen Kommentar bzw. Antwort (bis Ebene 2) posten. */
export async function addComment(
  userId: string,
  role: string,
  input: { lessonId: string; parentId?: string | null; content: string }
): Promise<AddCommentResult> {
  const access = await communityAccess(userId, role, input.lessonId);
  if (!access) return { ok: false, error: "unauthorized" };

  // Spam-Bremse: max. 10 Kommentare pro Nutzer in 5 Minuten
  if (
    !(await checkRateLimit(`comment:${userId}`, {
      limit: 10,
      windowMs: 5 * 60 * 1000,
    }))
  ) {
    return { ok: false, error: "too_many_attempts" };
  }

  const content = sanitizeRichText(input.content ?? "").trim();
  if (!content || content === "<p></p>") {
    return { ok: false, error: "comment_empty" };
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return { ok: false, error: "comment_too_long" };
  }

  let depth = 0;
  if (input.parentId) {
    const parent = await db.lessonComment.findUnique({
      where: { id: input.parentId },
      select: { lessonId: true, depth: true, deletedAt: true },
    });
    if (!parent || parent.lessonId !== input.lessonId || parent.deletedAt) {
      return { ok: false, error: "not_found" };
    }
    depth = parent.depth + 1;
    if (depth > MAX_DEPTH) {
      return { ok: false, error: "comment_too_deep" };
    }
  }

  // Inhaltsprüfung wie überall (FSK-18/Hass) – abgelehnt = nicht gespeichert
  if (isModerationEnabled()) {
    const verdict = await moderateEditorialText([content]);
    if (verdict.flagged) {
      return { ok: false, error: "content_flagged", reason: verdict.reason };
    }
  }

  await db.lessonComment.create({
    data: {
      lessonId: input.lessonId,
      userId,
      parentId: input.parentId ?? null,
      depth,
      content,
    },
  });
  return { ok: true };
}

/** Löschen: eigener Kommentar oder als Kurs-Creator/Admin (Soft-Delete). */
export async function deleteComment(
  userId: string,
  role: string,
  commentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const comment = await db.lessonComment.findUnique({
    where: { id: commentId },
    select: {
      userId: true,
      lesson: {
        select: { section: { select: { course: { select: { creatorId: true } } } } },
      },
    },
  });
  if (!comment) return { ok: false, error: "not_found" };

  const isOwn = comment.userId === userId;
  const isCourseCreator =
    comment.lesson.section.course.creatorId === userId;
  if (!isOwn && !isCourseCreator && role !== "ADMIN") {
    return { ok: false, error: "unauthorized" };
  }

  await db.lessonComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}
