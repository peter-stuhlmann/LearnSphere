import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { buildEmail } from "@/lib/email-template";

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
    const locale = entry.locale === "en" ? "en" : "de";
    const url = courseUrl(locale, course.slug);
    const t = await getTranslations({ locale, namespace: "mail.waitlist" });
    try {
      const mail = buildEmail({
        locale,
        preview: t("preview"),
        heading: t("heading"),
        paragraphs: [t("intro", { title: course.title })],
        button: { label: t("button"), url },
        note: t("note"),
      });
      await sendMail({
        to: entry.email,
        sender: "hello",
        subject: t("subject", { title: course.title }),
        text: mail.text,
        html: mail.html,
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
