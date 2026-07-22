import { describe, expect, it } from "vitest";
import { hasApiAccess, isApiPlanUsable } from "./api-access";

describe("isApiPlanUsable", () => {
  it("aktives Abo und Kulanzfenster gelten", () => {
    expect(isApiPlanUsable("ACTIVE")).toBe(true);
    expect(isApiPlanUsable("PAST_DUE")).toBe(true);
  });

  it("gekündigt, fehlend oder null gelten nicht", () => {
    expect(isApiPlanUsable("CANCELED")).toBe(false);
    expect(isApiPlanUsable(undefined)).toBe(false);
    expect(isApiPlanUsable(null)).toBe(false);
  });
});

describe("hasApiAccess", () => {
  it("Admins kommen ohne Abo rein – sie betreiben die Plattform", () => {
    expect(hasApiAccess({ role: "ADMIN", status: null })).toBe(true);
    expect(hasApiAccess({ role: "ADMIN", status: "CANCELED" })).toBe(true);
  });

  it("alle anderen brauchen ein gültiges Abo", () => {
    expect(hasApiAccess({ role: "CREATOR", status: "ACTIVE" })).toBe(true);
    expect(hasApiAccess({ role: "CREATOR", status: "PAST_DUE" })).toBe(true);
    expect(hasApiAccess({ role: "CREATOR", status: "CANCELED" })).toBe(false);
    expect(hasApiAccess({ role: "CLIENT", status: null })).toBe(false);
  });

  it("fehlende Rolle verschafft keinen Zugang", () => {
    expect(hasApiAccess({ role: undefined, status: null })).toBe(false);
    expect(hasApiAccess({ role: null, status: null })).toBe(false);
    // kein Freifahrtschein durch einen zufällig ähnlichen Wert
    expect(hasApiAccess({ role: "admin", status: null })).toBe(false);
  });
});
