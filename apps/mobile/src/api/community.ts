import {
  commentsListSchema,
  notesListSchema,
  ownReviewSchema,
  type CommentDto,
  type NoteDto,
  type UpdateProfileRequest,
} from "@elearning/api-contracts/mobile/v1/community";
import { apiRequest } from "./client";

/* Notizen (privat), Kommentare (Community), Reviews, Profil. */

export async function fetchNotes(lessonId: string): Promise<NoteDto[]> {
  const raw = await apiRequest<unknown>(
    `/api/mobile/v1/lessons/${lessonId}/notes`
  );
  return notesListSchema.parse(raw).data;
}

export async function addNote(
  lessonId: string,
  input: { content: string; blockId?: string | null; timeSeconds?: number | null }
): Promise<void> {
  await apiRequest(`/api/mobile/v1/lessons/${lessonId}/notes`, {
    method: "POST",
    body: input,
  });
}

export async function deleteNote(noteId: string): Promise<void> {
  await apiRequest(`/api/mobile/v1/notes/${noteId}`, { method: "DELETE" });
}

export async function fetchComments(lessonId: string): Promise<CommentDto[]> {
  const raw = await apiRequest<unknown>(
    `/api/mobile/v1/lessons/${lessonId}/comments`
  );
  return commentsListSchema.parse(raw).data;
}

export async function addComment(
  lessonId: string,
  input: { content: string; parentId?: string | null }
): Promise<void> {
  await apiRequest(`/api/mobile/v1/lessons/${lessonId}/comments`, {
    method: "POST",
    body: input,
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiRequest(`/api/mobile/v1/comments/${commentId}`, {
    method: "DELETE",
  });
}

export async function fetchOwnReview(
  courseId: string
): Promise<{ rating: number; comment: string | null } | null> {
  const raw = await apiRequest<unknown>(
    `/api/mobile/v1/courses/${courseId}/review`
  );
  return ownReviewSchema.parse(raw).review;
}

export async function submitReview(
  courseId: string,
  input: { rating: number; comment?: string }
): Promise<void> {
  await apiRequest(`/api/mobile/v1/courses/${courseId}/review`, {
    method: "PUT",
    body: input,
  });
}

export async function updateProfile(input: UpdateProfileRequest): Promise<void> {
  await apiRequest("/api/mobile/v1/me", { method: "PATCH", body: input });
}
