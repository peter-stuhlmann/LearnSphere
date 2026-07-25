/**
 * Läuft einmal beim Server-Start (Next.js Instrumentation Hook):
 * 1. Fail-Fast-Validierung der Umgebungsvariablen – eine fehlende
 *    Pflicht-Variable stoppt den Start mit lesbarer Meldung, statt erst
 *    beim ersten Request zu knallen.
 * 2. Sentry-Initialisierung (nur wenn SENTRY_DSN gesetzt ist).
 * 3. Kampagnen-Scheduler: verschickt geplante Creator-Mails minütlich –
 *    der Docker-Container läuft dauerhaft, ein externer Cron ist nicht
 *    nötig. Bei mehreren Replikas schützt der Status-Claim im Service
 *    vor Doppel-Versand; /api/cron/campaigns bleibt als externer
 *    Trigger-Weg zusätzlich bestehen.
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

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { processDueCampaigns } = await import(
      "@/lib/services/creator-email-service"
    );
    const run = () =>
      processDueCampaigns(new Date()).catch((err) =>
        console.error("[creator-email] Scheduler-Lauf fehlgeschlagen:", err)
      );
    // beim Start einmal nachholen (Fälliges aus einer Downtime), dann minütlich
    void run();
    setInterval(run, 60_000);
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
