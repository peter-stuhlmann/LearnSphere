import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authenticateApiRequest, retryAfterHeaders } from "@/lib/api-auth";
import { emailSchema, resolveEnrolledBuyer } from "../../../_lib/headless";
import { updateLessonProgress } from "@/lib/services/progress-service";

/*
 * Bewusst KEIN CORS/OPTIONS: Dieser Endpoint gehört auf den Server des
 * Integrators – der API-Key darf nie in Browser-Code stehen.
 */

const progressSchema = z.object({
  email: emailSchema,
  watchedSeconds: z.number().min(0).max(1_000_000),
  forceComplete: z.boolean().optional(),
  positions: z.record(z.string(), z.number().min(0)).optional(),
});

/**
 * PATCH /api/v1/lessons/[lessonId]/progress – Lernfortschritt einer
 * eingeschriebenen Käufer:in melden (monotone Zusammenführung wie im
 * Web; forceComplete markiert Text-Lektionen als gelesen). Der
 * Fortschritt zählt für die Zulassung zur Abschlussprüfung. Nur für
 * Lektionen der eigenen Kurse.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status, headers: retryAfterHeaders(authResult.status) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { lessonId } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      section: {
        select: { courseId: true, course: { select: { creatorId: true } } },
      },
    },
  });
  if (!lesson || lesson.section.course.creatorId !== authResult.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buyer = await resolveEnrolledBuyer(
    parsed.data.email,
    lesson.section.courseId,
    authResult.userId
  );
  if (!buyer.ok) {
    return NextResponse.json(
      { error: buyer.error },
      { status: buyer.error === "email_invalid" ? 400 : 403 }
    );
  }

  const result = await updateLessonProgress(buyer.userId, {
    lessonId,
    watchedSeconds: parsed.data.watchedSeconds,
    forceComplete: parsed.data.forceComplete,
    positions: parsed.data.positions,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "not_enrolled" ? 403 : 404 }
    );
  }
  return NextResponse.json({ data: { ok: true } });
}
