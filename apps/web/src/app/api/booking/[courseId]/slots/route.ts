import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildSlotsUrl,
  isValidBookingDate,
  parseSlotsResponse,
} from "@/lib/termine";
import { checkBookingAccess } from "../access";

/**
 * Proxy für freie termine.lol-Slots eines Tages (je Terminart).
 * Query: ?date=YYYY-MM-DD&appointmentTypeId=…
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await context.params;
  const date = request.nextUrl.searchParams.get("date") ?? "";
  const appointmentTypeId =
    request.nextUrl.searchParams.get("appointmentTypeId") ?? "";
  if (!isValidBookingDate(date) || !appointmentTypeId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const access = await checkBookingAccess(courseId);
  if (access instanceof NextResponse) return access;

  if (
    !(await checkRateLimit(`booking-slots:${courseId}`, {
      limit: 60,
      windowMs: 60_000,
    }))
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      buildSlotsUrl(access.calendarId, date, appointmentTypeId),
      { headers: { "x-api-key": access.apiKey }, cache: "no-store" }
    );
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return NextResponse.json({ error: "config_invalid" }, { status: 502 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const slots = parseSlotsResponse(await upstream.json().catch(() => null));
  if (!slots) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  return NextResponse.json(slots);
}
