import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { API_CORS_HEADERS } from "@/lib/api-auth";
import {
  buildHealthReport,
  healthHttpStatus,
  type HealthCheck,
} from "@/lib/health";

/* Nie zwischenspeichern: Ein gecachter Health-Check meldet "gesund",
   während der Dienst längst am Boden liegt. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Hängt die Datenbank, soll der Check trotzdem zügig antworten. */
const DB_TIMEOUT_MS = 3000;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS });
}

async function checkDatabase(): Promise<HealthCheck> {
  const started = performance.now();
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS)
      ),
    ]);
    return { status: "ok", durationMs: Math.round(performance.now() - started) };
  } catch (err) {
    // Die Ursache gehört ins Log, nicht in die Antwort: Ein öffentlicher
    // Endpunkt darf keine Verbindungsdaten oder Stacktraces preisgeben.
    console.error("[health] Datenbank nicht erreichbar:", err);
    return {
      status: "error",
      durationMs: Math.round(performance.now() - started),
    };
  }
}

/**
 * GET /api/health – Betriebsbereitschaft, ohne API-Key.
 *
 * Antwortet 200, solange alle Prüfungen bestehen, sonst 503. Gedacht für
 * Monitoring, Load Balancer und den Docker-Healthcheck. Die Antwort enthält
 * bewusst keine internen Details (Hostnamen, Fehlertexte, Migrationsstand) –
 * der Endpunkt ist öffentlich erreichbar.
 */
export async function GET() {
  const report = buildHealthReport({
    checks: { database: await checkDatabase() },
    uptimeSeconds: process.uptime(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
    now: new Date(),
  });

  return NextResponse.json(report, {
    status: healthHttpStatus(report),
    headers: {
      ...API_CORS_HEADERS,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
