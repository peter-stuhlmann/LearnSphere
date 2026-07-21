import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Lokalisierte Kurs-URL (deutsche Pfade unter /de). */
function courseUrl(locale: string, slug: string): string {
  return locale === "de"
    ? `${appUrl()}/de/kurse/${slug}`
    : `${appUrl()}/en/courses/${slug}`;
}

/**
 * Warteliste benachrichtigen: wird beim Veröffentlichen eines Kurses
 * aufgerufen. notifiedAt stellt sicher, dass jede Adresse genau einmal
 * Post bekommt – auch wenn der Kurs mehrfach (un)veröffentlicht wird.
 * Fehler einzelner Mails blockieren weder die Aktion noch die übrigen Mails.
 */
export async function notifyWaitlist(courseId: string): Promise<void> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { slug: true, title: true, published: true },
  });
  if (!course || !course.published) return;

  const entries = await db.waitlistEntry.findMany({
    where: { courseId, notifiedAt: null },
    select: { id: true, email: true, locale: true },
  });

  for (const entry of entries) {
    const de = entry.locale !== "en";
    const url = courseUrl(de ? "de" : "en", course.slug);
    try {
      await sendMail({
        to: entry.email,
        sender: "hello",
        subject: de
          ? `„${course.title}" ist jetzt verfügbar 🎉`
          : `"${course.title}" is now available 🎉`,
        text: de
          ? `Gute Nachrichten: Der Kurs „${course.title}", für den du auf der Warteliste stehst, ist jetzt auf LearnSphere verfügbar.\n\nZum Kurs:\n${url}\n\nDu erhältst diese Mail einmalig, weil du dich auf die Warteliste eingetragen hast.`
          : `Good news: the course "${course.title}" you joined the waitlist for is now available on LearnSphere.\n\nView the course:\n${url}\n\nYou receive this one-time email because you joined the waitlist.`,
      });
      await db.waitlistEntry.update({
        where: { id: entry.id },
        data: { notifiedAt: new Date() },
      });
    } catch {
      // Mail-Fehler: Eintrag bleibt unbenachrichtigt und wird beim
      // nächsten Veröffentlichen erneut versucht
    }
  }
}
