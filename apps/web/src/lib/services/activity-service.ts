import { shiftDay, utcDayString } from "@elearning/core/streak";
import { db } from "@/lib/db";

/**
 * Lern-Streak: schreibt je Nutzer und UTC-Kalendertag genau einen
 * Aktivitäts-Eintrag (Lektion besucht, Fortschritt, Prüfung, Karteikarten).
 * Wird von den Services aufgerufen – niemals blockierend für das Feature.
 */

export async function recordLearnActivity(userId: string): Promise<void> {
  const day = utcDayString(new Date());
  try {
    await db.learnActivity.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day },
      update: {},
    });
  } catch {
    // Streak ist nie wichtiger als das eigentliche Feature
  }
}

/** Aktivitätstage der letzten ~13 Monate (reicht für Streak + Wochenleiste). */
export async function getActivityDays(userId: string): Promise<string[]> {
  const since = shiftDay(utcDayString(new Date()), -400);
  const rows = await db.learnActivity.findMany({
    where: { userId, day: { gte: since } },
    select: { day: true },
  });
  return rows.map((row) => row.day);
}
