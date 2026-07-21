/**
 * Pure Rate-Limit-Logik (testbar). Der Backend-Dispatcher (Upstash Redis
 * mit In-Memory-Fallback) liegt in rate-limit.ts.
 */

const hits = new Map<string, number[]>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  now?: number;
}

/** In-Memory-Sliding-Window – nur für Single-Instance (lokal/Dev). */
export function checkRateLimitMemory(
  key: string,
  { limit, windowMs, now = Date.now() }: RateLimitOptions
): boolean {
  const windowStart = now - windowMs;
  const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    hits.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return true;
}

export function resetRateLimits(): void {
  hits.clear();
}

/**
 * Redis-Schlüssel für ein Fixed-Window: gleiche Anfrage-Klasse + gleiches
 * Zeitfenster → gleicher Zähler auf allen Instanzen.
 */
export function fixedWindowKey(
  key: string,
  windowMs: number,
  now: number
): string {
  return `rl:${key}:${Math.floor(now / windowMs)}`;
}
