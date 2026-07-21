"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeBuckets } from "@elearning/core/heatmap";
import type { ActionResult } from "./auth-actions";

/**
 * Video-Heatmap: gesehene Zeit-Buckets eines Medienblocks zählen.
 * Anonym (nur Zähler, kein Nutzerbezug); der Client meldet jeden Bucket
 * höchstens einmal pro Sitzung.
 */
export async function recordWatchBuckets(input: {
  blockId: string;
  buckets: number[];
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const buckets = sanitizeBuckets(input.buckets);
  if (buckets.length === 0) return { ok: true };

  if (
    !(await checkRateLimit(`heatmap:${session.user.id}`, {
      limit: 120,
      windowMs: 60 * 60_000,
    }))
  ) {
    return { ok: true }; // Statistik ist nie ein Fehlergrund für den Player
  }

  const block = await db.lessonBlock.findUnique({
    where: { id: input.blockId },
    select: {
      id: true,
      type: true,
      lesson: {
        select: {
          section: {
            select: { course: { select: { id: true, creatorId: true } } },
          },
        },
      },
    },
  });
  if (!block || (block.type !== "VIDEO" && block.type !== "AUDIO")) {
    return { ok: false, error: "not_found" };
  }

  const course = block.lesson.section.course;
  if (course.creatorId !== session.user.id) {
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: { userId: session.user.id, courseId: course.id },
      },
      select: { id: true },
    });
    if (!enrollment) return { ok: false, error: "not_enrolled" };
  }

  // Zähler hochsetzen (ein Statement je Bucket, gebündelt als Transaktion)
  await db.$transaction(
    buckets.map((bucket) =>
      db.blockWatchBucket.upsert({
        where: { blockId_bucket: { blockId: block.id, bucket } },
        create: { blockId: block.id, bucket, views: 1 },
        update: { views: { increment: 1 } },
      })
    )
  );

  return { ok: true };
}
