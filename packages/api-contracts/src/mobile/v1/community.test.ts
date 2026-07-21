import { describe, expect, it } from "vitest";
import {
  addCommentRequestSchema,
  addNoteRequestSchema,
  commentsListSchema,
  notesListSchema,
  ownReviewSchema,
  reviewRequestSchema,
  updateNoteRequestSchema,
  updateProfileRequestSchema,
} from "./community";

describe("community contracts", () => {
  it("validiert Notizen (Liste + Anlegen + Ändern)", () => {
    expect(
      notesListSchema.safeParse({
        data: [
          {
            id: "n1",
            blockId: "b1",
            timeSeconds: 272,
            content: "Wichtig!",
            createdAt: "2026-07-14T00:00:00.000Z",
          },
        ],
      }).success
    ).toBe(true);
    expect(
      addNoteRequestSchema.safeParse({ content: "Notiz", timeSeconds: 4.7 })
        .success
    ).toBe(true);
    expect(addNoteRequestSchema.safeParse({ content: "  " }).success).toBe(
      false
    );
    expect(updateNoteRequestSchema.safeParse({ content: "Neu" }).success).toBe(
      true
    );
  });

  it("validiert Kommentare (Liste + Posten)", () => {
    expect(
      commentsListSchema.safeParse({
        data: [
          {
            id: "c1",
            parentId: null,
            depth: 0,
            userId: "u1",
            userName: "Ada",
            userImage: null,
            isCreator: true,
            content: "<p>Hi</p>",
            deleted: false,
            createdAt: "2026-07-14T00:00:00.000Z",
          },
        ],
      }).success
    ).toBe(true);
    expect(
      addCommentRequestSchema.safeParse({ content: "Frage?", parentId: "c1" })
        .success
    ).toBe(true);
  });

  it("validiert Review- und Profil-Requests", () => {
    expect(reviewRequestSchema.safeParse({ rating: 5 }).success).toBe(true);
    expect(reviewRequestSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(
      ownReviewSchema.safeParse({ review: { rating: 4, comment: null } })
        .success
    ).toBe(true);
    expect(ownReviewSchema.safeParse({ review: null }).success).toBe(true);
    expect(
      updateProfileRequestSchema.safeParse({ name: "Ada", locale: "en" })
        .success
    ).toBe(true);
    expect(updateProfileRequestSchema.safeParse({ name: "x" }).success).toBe(
      false
    );
  });
});
