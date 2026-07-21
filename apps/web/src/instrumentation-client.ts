import * as Sentry from "@sentry/nextjs";

/**
 * Browser-seitiges Fehler-Monitoring – nur aktiv, wenn ein öffentlicher
 * DSN konfiguriert ist. Kein Session-Replay, kein Tracing: wir sammeln
 * ausschließlich Fehler (datensparsam, DSGVO-freundlich).
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
    // IP-Adressen nicht ans Event hängen
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
