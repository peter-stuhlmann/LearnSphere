import { describe, expect, it } from "vitest";
import {
  ANONYMIZED_CREATOR_NAME,
  RETENTION_YEARS,
  anonymizedEmail,
  retentionPurgeDate,
} from "./retention";

describe("retentionPurgeDate", () => {
  it("rechnet ab dem Jahresende des Geschäftsvorfalls", () => {
    // Kauf im März 2026 → Frist läuft Ende 2036 ab → löschbar ab 1.1.2037
    expect(retentionPurgeDate(new Date("2026-03-15T10:00:00Z")).toISOString()).toBe(
      "2037-01-01T00:00:00.000Z"
    );
    // Silvester zählt noch zum alten Jahr
    expect(retentionPurgeDate(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe(
      "2037-01-01T00:00:00.000Z"
    );
    // Neujahr beginnt die Frist ein Jahr später
    expect(retentionPurgeDate(new Date("2027-01-01T00:00:00Z")).toISOString()).toBe(
      "2038-01-01T00:00:00.000Z"
    );
  });

  it("erlaubt abweichende Fristen", () => {
    expect(retentionPurgeDate(new Date("2026-06-01T00:00:00Z"), 8).toISOString()).toBe(
      "2035-01-01T00:00:00.000Z"
    );
    expect(RETENTION_YEARS).toBe(10);
  });
});

describe("anonymizedEmail", () => {
  it("ist eindeutig je Nutzer und nicht zustellbar", () => {
    expect(anonymizedEmail("abc123")).toBe("deleted-abc123@deleted.invalid");
    expect(anonymizedEmail("a")).not.toBe(anonymizedEmail("b"));
  });

  it("Anzeigename ist gesetzt", () => {
    expect(ANONYMIZED_CREATOR_NAME.length).toBeGreaterThan(0);
  });
});
