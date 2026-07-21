import type { NextRequest } from "next/server";
import { STAT_RANGES, type StatRange } from "@elearning/core/stats";
import { authenticateMobileRequest } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { jsonError, jsonResponse } from "@/lib/mobile/http";
import { loadCreatorTotals } from "@/lib/creator-stats";
import { loadPayoutSummary } from "@/lib/payout-server";

/** Creator-Dashboard (read-only): KPIs, Guthaben, eigene Kurse. */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateMobileRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  if (auth.role !== "CREATOR" && auth.role !== "ADMIN") {
    return jsonError("unauthorized", 403);
  }

  const rangeParam = request.nextUrl.searchParams.get("range");
  const range: StatRange = (STAT_RANGES as readonly string[]).includes(
    rangeParam ?? ""
  )
    ? (rangeParam as StatRange)
    : "all";

  const [totals, payout, courses] = await Promise.all([
    loadCreatorTotals(auth.userId, range),
    loadPayoutSummary(auth.userId),
    db.course.findMany({
      where: { creatorId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        published: true,
        priceCents: true,
        enrollments: { select: { creatorShareCents: true } },
      },
    }),
  ]);

  return jsonResponse({
    totals,
    payout: {
      balanceCents: payout.balanceCents,
      pendingCents: payout.pendingCents,
      hasOpenRequest: payout.hasOpenRequest,
      history: payout.history,
    },
    courses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      published: course.published,
      priceCents: course.priceCents,
      enrollmentCount: course.enrollments.length,
      revenueCents: course.enrollments.reduce(
        (sum, e) => sum + e.creatorShareCents,
        0
      ),
    })),
  });
}
