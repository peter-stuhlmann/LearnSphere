import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authenticateApiRequest, retryAfterHeaders } from "@/lib/api-auth";

/*
 * Bewusst KEIN CORS/OPTIONS: Dieser Endpoint gehört auf den Server des
 * Integrators – der API-Key darf nie in Browser-Code stehen.
 */

const emailSchema = z
  .email()
  .max(191)
  .transform((value) => value.toLowerCase());

/**
 * GET /api/v1/enrollments?email=…[&course=slug] – Einschreibungen einer
 * Käufer:in in den EIGENEN Kursen des Key-Inhabers.
 *
 * Damit gated die Headless-Seite ihre Inhalte: Nutzerin einloggen (beim
 * Integrator), E-Mail hier prüfen, bei Treffer den Kursinhalt aus
 * /api/v1/courses/{slug}/content ausliefern. Fremde Kurse und fremde
 * Käufe sind nicht sichtbar; ob eine E-Mail überhaupt ein Konto hat,
 * verrät die Antwort ebenfalls nicht (leer ist leer).
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status, headers: retryAfterHeaders(authResult.status) }
    );
  }

  const parsedEmail = emailSchema.safeParse(
    request.nextUrl.searchParams.get("email") ?? ""
  );
  if (!parsedEmail.success) {
    return NextResponse.json({ error: "email_invalid" }, { status: 400 });
  }
  const courseSlug = request.nextUrl.searchParams.get("course");

  const user = await db.user.findUnique({
    where: { email: parsedEmail.data },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json(
      { data: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const enrollments = await db.enrollment.findMany({
    where: {
      userId: user.id,
      course: {
        creatorId: authResult.userId,
        ...(courseSlug ? { slug: courseSlug } : {}),
      },
    },
    select: {
      createdAt: true,
      completedAt: true,
      course: { select: { slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    {
      data: enrollments.map((enrollment) => ({
        course: enrollment.course.slug,
        enrolledAt: enrollment.createdAt,
        completedAt: enrollment.completedAt,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
