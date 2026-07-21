"use server";

import { auth } from "@/auth";
import { fetchYouTubeDurationSeconds } from "@/lib/youtube-server";

/** YouTube-Dauer für den Lektions-Editor ermitteln (Browser kann das nicht). */
export async function fetchYouTubeDuration(
  url: string
): Promise<{ ok: boolean; seconds?: number }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const seconds = await fetchYouTubeDurationSeconds(url);
  return seconds > 0 ? { ok: true, seconds } : { ok: false };
}
