import { parseIsoDuration, parseYouTubeId } from "@/lib/video";

/**
 * Dauer eines YouTube-Videos serverseitig ermitteln (der Browser kann das
 * wegen CORS/Consent nicht): bevorzugt über die YouTube Data API
 * (YOUTUBE_API_KEY), sonst über die Watch-Seite ("lengthSeconds").
 * Fail-safe: 0, wenn nichts ermittelbar ist.
 */
export async function fetchYouTubeDurationSeconds(
  url: string
): Promise<number> {
  const videoId = parseYouTubeId(url);
  if (!videoId) return 0;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`,
        { signal: AbortSignal.timeout(8_000) }
      );
      if (response.ok) {
        const body = (await response.json()) as {
          items?: { contentDetails?: { duration?: string } }[];
        };
        const iso = body.items?.[0]?.contentDetails?.duration;
        const seconds = iso ? parseIsoDuration(iso) : 0;
        if (seconds > 0) return seconds;
      } else {
        console.error("[youtube] Data-API-Fehler:", response.status);
      }
    } catch (err) {
      console.error("[youtube] Data API fehlgeschlagen:", err);
    }
  }

  try {
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}&hl=en`,
      {
        headers: { "accept-language": "en" },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (response.ok) {
      const match = /"lengthSeconds":"(\d+)"/.exec(await response.text());
      if (match) return Number(match[1]);
    }
  } catch (err) {
    console.error("[youtube] Dauer-Ermittlung fehlgeschlagen:", err);
  }
  return 0;
}

type TranslationOverride = { url?: string; durationSeconds?: number };

/**
 * Fehlende Dauern von YouTube-Video-Blöcken beim Speichern nachziehen –
 * damit Sidebar und Fortschrittsgewichtung zuverlässig stimmen. Gilt auch
 * für übersetzte Video-URLs (translations[lang].url).
 */
export async function withYouTubeDurations<
  T extends {
    type: string;
    url?: string;
    durationSeconds?: number;
    translations?: Partial<Record<string, TranslationOverride>>;
  },
>(blocks: T[]): Promise<T[]> {
  return Promise.all(
    blocks.map(async (block) => {
      if (block.type !== "VIDEO") return block;

      let result = block;
      if (
        block.url &&
        (block.durationSeconds ?? 0) === 0 &&
        parseYouTubeId(block.url)
      ) {
        const seconds = await fetchYouTubeDurationSeconds(block.url);
        if (seconds > 0) result = { ...result, durationSeconds: seconds };
      }

      const translations = result.translations ?? {};
      const updated: Record<string, TranslationOverride> = {};
      let changed = false;
      for (const [lang, override] of Object.entries(translations)) {
        if (
          override?.url &&
          (override.durationSeconds ?? 0) === 0 &&
          parseYouTubeId(override.url)
        ) {
          const seconds = await fetchYouTubeDurationSeconds(override.url);
          if (seconds > 0) {
            updated[lang] = { ...override, durationSeconds: seconds };
            changed = true;
            continue;
          }
        }
        if (override) updated[lang] = override;
      }
      return changed
        ? { ...result, translations: updated }
        : result;
    })
  );
}
