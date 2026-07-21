/** YouTube-Video-IDs sind exakt 11 Zeichen aus [A-Za-z0-9_-]. */
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/**
 * Extrahiert die Video-ID aus allen gängigen YouTube-URL-Formen
 * (watch, youtu.be, embed, shorts). Gibt null zurück, wenn die URL
 * kein gültiges YouTube-Video referenziert.
 */
export function parseYouTubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  let candidate: string | null = null;

  if (parsed.hostname === "youtu.be") {
    candidate = parsed.pathname.slice(1).split("/")[0] || null;
  } else if (YOUTUBE_HOSTS.has(parsed.hostname)) {
    if (parsed.pathname === "/watch") {
      candidate = parsed.searchParams.get("v");
    } else {
      const match = parsed.pathname.match(/^\/(embed|shorts)\/([^/]+)/);
      candidate = match?.[2] ?? null;
    }
  }

  return candidate && YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
}

/**
 * ISO-8601-Dauer (z. B. "PT1H2M3S" der YouTube Data API) → Sekunden.
 * Ungültige Eingaben ergeben 0.
 */
export function parseIsoDuration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso.trim());
  if (!match || (!match[1] && !match[2] && !match[3])) return 0;
  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
}
