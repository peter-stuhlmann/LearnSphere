import {
  checkRateLimitMemory,
  fixedWindowKey,
  type RateLimitOptions,
} from "./rate-limit-core";
import { getEnv } from "./env";

export type { RateLimitOptions } from "./rate-limit-core";
export { resetRateLimits } from "./rate-limit-core";

/**
 * Verteiltes Rate-Limit: Mit konfiguriertem Upstash Redis teilen sich alle
 * Serverless-Instanzen denselben Zähler (Fixed Window via INCR+PEXPIRE).
 * Ohne Konfiguration – oder wenn Redis nicht erreichbar ist – greift der
 * In-Memory-Fallback (ausreichend für lokale Entwicklung/Single-Instance).
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<boolean> {
  const env = getEnv();
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const allowed = await redisCheck(
      env.UPSTASH_REDIS_REST_URL,
      env.UPSTASH_REDIS_REST_TOKEN,
      key,
      options
    );
    if (allowed !== null) return allowed;
    // Redis nicht erreichbar → fail-open auf lokalen Zähler (Verfügbarkeit
    // schlägt hier Strenge; geloggt wird der Ausfall in redisCheck)
  }
  return checkRateLimitMemory(key, options);
}

async function redisCheck(
  url: string,
  token: string,
  key: string,
  { limit, windowMs, now = Date.now() }: RateLimitOptions
): Promise<boolean | null> {
  const bucket = fixedWindowKey(key, windowMs, now);
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", bucket],
        ["PEXPIRE", bucket, String(windowMs), "NX"],
      ]),
      // Limit-Prüfung darf Requests nicht endlos blockieren
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const results = (await res.json()) as { result?: number }[];
    const count = results[0]?.result;
    if (typeof count !== "number") throw new Error("Upstash: kein Zähler");
    return count <= limit;
  } catch (err) {
    console.error("[rate-limit] Redis nicht erreichbar, Fallback:", err);
    return null;
  }
}
