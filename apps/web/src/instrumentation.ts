/**
 * Läuft einmal beim Server-Start (Next.js Instrumentation Hook):
 * 1. Fail-Fast-Validierung der Umgebungsvariablen – eine fehlende
 *    Pflicht-Variable stoppt den Start mit lesbarer Meldung, statt erst
 *    beim ersten Request zu knallen.
 * 2. Sentry-Initialisierung (nur wenn SENTRY_DSN gesetzt ist).
 */
export async function register() {
  const { getEnv } = await import("@/lib/env");
  const env = getEnv();

  if (env.SENTRY_DSN && process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      // bewusst nur Fehler, kein Performance-Tracing (Kosten/Noise)
      tracesSampleRate: 0,
    });
  }
}

/** Server-seitige Request-Fehler an Sentry melden (Next.js Hook). */
export async function onRequestError(
  ...args: Parameters<
    typeof import("@sentry/nextjs").captureRequestError
  >
) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
}
