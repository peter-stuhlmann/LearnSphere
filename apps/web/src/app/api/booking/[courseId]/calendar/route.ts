import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildCalendarUrl, parseCalendarResponse } from "@/lib/termine";
import { checkBookingAccess } from "../access";

/**
 * Proxy für die termine.lol-Kalenderkonfiguration (Terminarten, Zeitzone).
 * Der API-Key des Creators bleibt serverseitig; der Client bekommt nur die
 * bereinigten Kalenderdaten plus die (nicht geheime) Kalender-ID für den
 * anschließenden öffentlichen Reserve-Call.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await context.params;
  const access = await checkBookingAccess(courseId);
  if (access instanceof NextResponse) return access;

  if (
    !(await checkRateLimit(`booking-calendar:${courseId}`, {
      limit: 30,
      windowMs: 60_000,
    }))
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(buildCalendarUrl(access.calendarId), {
      headers: { "x-api-key": access.apiKey },
      // Terminarten ändern sich selten – kurzer Cache entlastet das Kontingent
      next: { revalidate: 300 },
    });
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  if (upstream.status === 401 || upstream.status === 403) {
    // Key ungültig/abgelaufen – für Lernende ist das "nicht konfiguriert"
    return NextResponse.json({ error: "config_invalid" }, { status: 502 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const calendar = parseCalendarResponse(
    await upstream.json().catch(() => null)
  );
  if (!calendar) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  return NextResponse.json({
    calendarId: access.calendarId,
    title: calendar.title,
    timezone: calendar.timezone,
    appointmentTypes: calendar.appointmentTypes,
  });
}
