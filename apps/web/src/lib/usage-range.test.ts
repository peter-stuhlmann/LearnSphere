import { describe, expect, it } from "vitest";
import {
  isUsagePreset,
  MAX_RANGE_DAYS,
  parseIsoDay,
  resolveUsageRange,
  startOfUtcDay,
  toIsoDay,
} from "./usage-range";

// mitten am Tag, damit die Tagesgrenzen wirklich geprüft werden
const now = new Date("2026-07-22T13:45:12.000Z");

describe("Tageshilfen", () => {
  it("schneidet auf Mitternacht UTC ab", () => {
    expect(startOfUtcDay(now).toISOString()).toBe("2026-07-22T00:00:00.000Z");
  });

  it("formatiert als YYYY-MM-DD", () => {
    expect(toIsoDay(now)).toBe("2026-07-22");
  });

  it("liest gültige Datumsangaben", () => {
    expect(parseIsoDay("2026-07-01")?.toISOString()).toBe(
      "2026-07-01T00:00:00.000Z"
    );
  });

  /* "2026-13-01" hat die richtige Form, ergibt aber ein Invalid Date;
     "2026-02-31" ist ein Scheindatum, das JS auf den 3. März weiterrollt.
     Beide müssen abgefangen werden. */
  it.each([
    "",
    null,
    undefined,
    "22.07.2026",
    "2026-7-1",
    "2026-13-01",
    "2026-02-31",
    "quatsch",
  ])(
    "weist ungültige Eingabe zurück: %s",
    (value) => {
      expect(parseIsoDay(value)).toBeNull();
    }
  );

  it("erkennt bekannte Voreinstellungen", () => {
    expect(isUsagePreset("today")).toBe(true);
    expect(isUsagePreset("42d")).toBe(false);
  });
});

describe("resolveUsageRange – Voreinstellungen", () => {
  it("heute: genau ein Tag, endet heute", () => {
    const range = resolveUsageRange({ range: "today", now });
    expect(toIsoDay(range.from)).toBe("2026-07-22");
    expect(toIsoDay(range.to)).toBe("2026-07-22");
    expect(range.days).toBe(1);
    // exklusive Grenze ist Mitternacht des Folgetags
    expect(range.toExclusive.toISOString()).toBe("2026-07-23T00:00:00.000Z");
  });

  it("gestern: ein Tag, endet gestern – der einzige Zeitraum ohne heute", () => {
    const range = resolveUsageRange({ range: "yesterday", now });
    expect(toIsoDay(range.from)).toBe("2026-07-21");
    expect(toIsoDay(range.to)).toBe("2026-07-21");
    expect(range.days).toBe(1);
    expect(range.toExclusive.toISOString()).toBe("2026-07-22T00:00:00.000Z");
  });

  it("7 Tage schließen heute ein", () => {
    const range = resolveUsageRange({ range: "7d", now });
    expect(toIsoDay(range.from)).toBe("2026-07-16");
    expect(toIsoDay(range.to)).toBe("2026-07-22");
    expect(range.days).toBe(7);
  });

  it.each([
    ["30d", 30],
    ["90d", 90],
    ["365d", 365],
  ])("%s umfasst %i Tage", (preset, days) => {
    expect(resolveUsageRange({ range: preset, now }).days).toBe(days);
  });

  it("ohne Angabe und bei Unsinn gilt die Voreinstellung", () => {
    expect(resolveUsageRange({ now }).preset).toBe("30d");
    expect(resolveUsageRange({ range: "eeeewig", now }).preset).toBe("30d");
  });
});

describe("resolveUsageRange – frei gewählt", () => {
  it("nimmt beide Daten einschließlich", () => {
    const range = resolveUsageRange({
      from: "2026-07-01",
      to: "2026-07-03",
      now,
    });
    expect(range.preset).toBe("custom");
    expect(range.days).toBe(3);
    expect(range.toExclusive.toISOString()).toBe("2026-07-04T00:00:00.000Z");
  });

  it("ein einzelner Tag ist ein gültiger Zeitraum", () => {
    const range = resolveUsageRange({
      from: "2026-07-01",
      to: "2026-07-01",
      now,
    });
    expect(range.days).toBe(1);
  });

  it("dreht vertauschte Eingaben, statt zu meckern", () => {
    const range = resolveUsageRange({
      from: "2026-07-10",
      to: "2026-07-01",
      now,
    });
    expect(toIsoDay(range.from)).toBe("2026-07-01");
    expect(toIsoDay(range.to)).toBe("2026-07-10");
  });

  it("hat der Zeitraum nur ein Datum, gilt die Voreinstellung", () => {
    expect(resolveUsageRange({ from: "2026-07-01", now }).preset).toBe("30d");
    expect(resolveUsageRange({ to: "2026-07-01", now }).preset).toBe("30d");
  });

  it("zu lange Zeiträume fallen auf die Voreinstellung zurück", () => {
    const range = resolveUsageRange({
      from: "2020-01-01",
      to: "2026-01-01",
      now,
    });
    expect(range.preset).toBe("30d");
  });

  it("genau die Höchstspanne ist noch erlaubt", () => {
    const from = new Date(
      startOfUtcDay(now).getTime() - (MAX_RANGE_DAYS - 1) * 86_400_000
    );
    const range = resolveUsageRange({
      from: toIsoDay(from),
      to: toIsoDay(now),
      now,
    });
    expect(range.preset).toBe("custom");
    expect(range.days).toBe(MAX_RANGE_DAYS);
  });

  it("die Voreinstellung schlägt einen kaputten Zeitraum nicht", () => {
    const range = resolveUsageRange({
      range: "7d",
      from: "kaputt",
      to: "2026-07-01",
      now,
    });
    expect(range.preset).toBe("7d");
  });
});
