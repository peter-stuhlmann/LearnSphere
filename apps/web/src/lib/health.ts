/**
 * Health-Report der API.
 *
 * Die Auswertung ist bewusst von der Messung getrennt: Hier steckt nur die
 * Regel, wann der Dienst als gesund gilt und wie die Antwort aussieht – die
 * eigentliche Datenbankabfrage macht die Route. So bleibt die Regel testbar,
 * ohne dass ein Test eine Datenbank braucht.
 */

export type HealthState = "ok" | "error";

export interface HealthCheck {
  status: HealthState;
  /** Dauer der Prüfung in Millisekunden */
  durationMs: number;
}

export interface HealthReport {
  status: HealthState;
  /** ISO-Zeitstempel der Prüfung */
  timestamp: string;
  /** Laufzeit dieses Prozesses in Sekunden */
  uptimeSeconds: number;
  version: string;
  checks: Record<string, HealthCheck>;
}

/**
 * Baut den Report und leitet den Gesamtstatus ab: Sobald eine einzelne
 * Prüfung fehlschlägt, ist der Dienst insgesamt nicht gesund. Ein Monitor
 * soll nicht erst die Teilergebnisse auswerten müssen.
 */
export function buildHealthReport(input: {
  checks: Record<string, HealthCheck>;
  uptimeSeconds: number;
  version: string;
  now: Date;
}): HealthReport {
  const values = Object.values(input.checks);
  const status: HealthState = values.every((check) => check.status === "ok")
    ? "ok"
    : "error";

  return {
    status,
    timestamp: input.now.toISOString(),
    // volle Sekunden reichen – Nachkommastellen wären nur Rauschen
    uptimeSeconds: Math.round(input.uptimeSeconds),
    version: input.version,
    checks: input.checks,
  };
}

/**
 * HTTP-Status zum Report. 503 statt 500, weil "vorübergehend nicht
 * verfügbar" genau der Fall ist, den ein Load Balancer sehen muss, um den
 * Container aus dem Verkehr zu nehmen.
 */
export function healthHttpStatus(report: HealthReport): number {
  return report.status === "ok" ? 200 : 503;
}
