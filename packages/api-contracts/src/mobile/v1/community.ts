import { z } from "zod";

/* Contracts: Notizen (privat), Kommentare (Community), Reviews, Profil. */

export const noteSchema = z.object({
  id: z.string(),
  blockId: z.string().nullable(),
  timeSeconds: z.number().nullable(),
  content: z.string(),
  createdAt: z.string(),
});
export type NoteDto = z.infer<typeof noteSchema>;

export const notesListSchema = z.object({ data: z.array(noteSchema) });

export const addNoteRequestSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  blockId: z.string().nullable().optional(),
  timeSeconds: z.number().min(0).nullable().optional(),
});
export type AddNoteRequest = z.infer<typeof addNoteRequestSchema>;

export const updateNoteRequestSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const commentSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  depth: z.number(),
  userId: z.string(),
  userName: z.string(),
  userImage: z.string().nullable(),
  isCreator: z.boolean(),
  content: z.string(),
  deleted: z.boolean(),
  createdAt: z.string(),
});
export type CommentDto = z.infer<typeof commentSchema>;

export const commentsListSchema = z.object({ data: z.array(commentSchema) });

export const addCommentRequestSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  parentId: z.string().nullable().optional(),
});
export type AddCommentRequest = z.infer<typeof addCommentRequestSchema>;

export const reviewRequestSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(10_000).optional(),
});
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

export const ownReviewSchema = z.object({
  review: z
    .object({ rating: z.number(), comment: z.string().nullable() })
    .nullable(),
});

export const updateProfileRequestSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  locale: z.enum(["de", "en"]).optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
