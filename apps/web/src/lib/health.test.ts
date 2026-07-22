import { describe, expect, it } from "vitest";
import { buildHealthReport, healthHttpStatus } from "./health";

const now = new Date("2026-07-22T10:15:00.000Z");

describe("buildHealthReport", () => {
  it("meldet ok, wenn alle Prüfungen bestehen", () => {
    const report = buildHealthReport({
      checks: { database: { status: "ok", durationMs: 3 } },
      uptimeSeconds: 42.7,
      version: "0.1.0",
      now,
    });

    expect(report.status).toBe("ok");
    expect(report.timestamp).toBe("2026-07-22T10:15:00.000Z");
    // auf volle Sekunden gerundet
    expect(report.uptimeSeconds).toBe(43);
    expect(report.version).toBe("0.1.0");
    expect(report.checks.database.durationMs).toBe(3);
  });

  it("meldet error, sobald eine einzelne Prüfung fehlschlägt", () => {
    const report = buildHealthReport({
      checks: {
        database: { status: "error", durationMs: 5000 },
        cache: { status: "ok", durationMs: 1 },
      },
      uptimeSeconds: 1,
      version: "0.1.0",
      now,
    });

    expect(report.status).toBe("error");
  });

  it("gilt ohne Prüfungen als gesund", () => {
    const report = buildHealthReport({
      checks: {},
      uptimeSeconds: 0,
      version: "0.1.0",
      now,
    });

    expect(report.status).toBe("ok");
    expect(report.checks).toEqual({});
  });
});

describe("healthHttpStatus", () => {
  it("antwortet mit 200, wenn der Dienst gesund ist", () => {
    const report = buildHealthReport({
      checks: {},
      uptimeSeconds: 0,
      version: "0.1.0",
      now,
    });
    expect(healthHttpStatus(report)).toBe(200);
  });

  it("antwortet mit 503 – nicht 500 – wenn etwas kaputt ist", () => {
    const report = buildHealthReport({
      checks: { database: { status: "error", durationMs: 0 } },
      uptimeSeconds: 0,
      version: "0.1.0",
      now,
    });
    expect(healthHttpStatus(report)).toBe(503);
  });
});
