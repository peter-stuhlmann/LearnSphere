import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Datenübertragbarkeit (Art. 20 DSGVO): alle personenbezogenen Daten des
 * eingeloggten Kontos als maschinenlesbarer JSON-Download.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (
    !(await checkRateLimit(`export:${session.user.id}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    }))
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const userId = session.user.id;
  const [
    user,
    enrollments,
    notes,
    comments,
    reviews,
    payouts,
    assistantMessages,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        emailVerified: true,
        role: true,
        locale: true,
        handle: true,
        storefrontName: true,
        creatorBio: true,
        affiliateCode: true,
        affiliateJoinedAt: true,
        createdAt: true,
        billingAddress: true,
      },
    }),
    db.enrollment.findMany({
      where: { userId },
      select: {
        course: { select: { title: true, slug: true } },
        pricePaidCents: true,
        couponCode: true,
        creditUsedCents: true,
        refundableUntil: true,
        guaranteeWaivedAt: true,
        completedAt: true,
        createdAt: true,
        lessonProgress: {
          select: {
            lessonId: true,
            watchedSeconds: true,
            completed: true,
          },
        },
        quizAttempts: {
          select: { scorePercent: true, passed: true, createdAt: true },
        },
        certificate: {
          select: { serial: true, scorePercent: true, issuedAt: true },
        },
      },
    }),
    db.lessonNote.findMany({
      where: { userId },
      select: {
        lessonId: true,
        timeSeconds: true,
        content: true,
        createdAt: true,
      },
    }),
    db.lessonComment.findMany({
      where: { userId },
      select: { lessonId: true, content: true, createdAt: true },
    }),
    db.review.findMany({
      where: { userId },
      select: {
        courseId: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    }),
    db.payout.findMany({
      where: { userId },
      select: {
        amountCents: true,
        status: true,
        holder: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    db.assistantMessage.findMany({
      where: { userId },
      select: {
        courseId: true,
        role: true,
        content: true,
        createdAt: true,
      },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    format: "learnsphere-account-export/v1",
    account: user,
    enrollments,
    notes,
    comments,
    reviews,
    payouts,
    assistantMessages,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="learnsphere-daten.json"',
      "Cache-Control": "no-store",
    },
  });
}
