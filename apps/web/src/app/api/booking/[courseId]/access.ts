import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isBookingConfigured } from "@/lib/termine";

/**
 * Zugriffsprüfung der Buchungs-Proxys: eingeloggt UND (eingeschrieben ODER
 * Creator des Kurses) UND der Kurs hat termine.lol konfiguriert. Der
 * API-Key verlässt den Server nie – die Routen proxien nur Kalender/Slots.
 */

export interface BookingAccess {
  ok: true;
  calendarId: string;
  apiKey: string;
}

export async function checkBookingAccess(
  courseId: string
): Promise<BookingAccess | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      creatorId: true,
      bookingEnabled: true,
      // Die Verbindung hängt am Creator-Konto, nicht am Kurs
      creator: {
        select: { bookingCalendarId: true, bookingApiKey: true },
      },
    },
  });
  if (!course) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const booking = {
    bookingEnabled: course.bookingEnabled,
    bookingCalendarId: course.creator.bookingCalendarId,
    bookingApiKey: course.creator.bookingApiKey,
  };
  if (!isBookingConfigured(booking)) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }

  if (course.creatorId !== session.user.id) {
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: { userId: session.user.id, courseId },
      },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "not_enrolled" }, { status: 403 });
    }
  }

  return {
    ok: true,
    calendarId: booking.bookingCalendarId!.trim(),
    apiKey: booking.bookingApiKey!.trim(),
  };
}
