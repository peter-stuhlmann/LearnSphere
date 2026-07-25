import { describe, expect, it } from "vitest";
import {
  workspaceDomainSchema,
  workspaceSchema,
  WORKSPACE_RESERVED_SLUGS,
} from "./validation";

describe("workspaceSchema", () => {
  it("akzeptiert gültige Slugs + Branding", () => {
    const result = workspaceSchema.safeParse({
      slug: "team-acme",
      brandName: "Acme Academy",
      brandColor: "#4DD8FF",
    });
    expect(result.success).toBe(true);
  });

  it("normalisiert Groß-/Kleinschreibung des Slugs", () => {
    const result = workspaceSchema.safeParse({
      slug: "Team-ACME",
      brandName: "Acme",
    });
    expect(result.success && result.data.slug).toBe("team-acme");
  });

  it("lehnt ungültige Slug-Zeichen und Ränder ab", () => {
    for (const slug of ["ab", "-lead", "trail-", "hat_unterstrich", "a"]) {
      expect(workspaceSchema.safeParse({ slug, brandName: "Ok" }).success).toBe(
        false
      );
    }
  });

  it("lehnt reservierte Slugs ab", () => {
    for (const slug of WORKSPACE_RESERVED_SLUGS) {
      expect(workspaceSchema.safeParse({ slug, brandName: "Ok" }).success).toBe(
        false
      );
    }
  });

  it("verlangt einen Anzeigenamen mit mind. 2 Zeichen", () => {
    expect(
      workspaceSchema.safeParse({ slug: "team-acme", brandName: "A" }).success
    ).toBe(false);
  });
});

describe("workspaceDomainSchema", () => {
  it("akzeptiert gültige Domains und normalisiert Kleinschreibung", () => {
    const result = workspaceDomainSchema.safeParse({
      customDomain: "Academy.Firma.DE",
    });
    expect(result.success && result.data.customDomain).toBe("academy.firma.de");
  });

  it("lehnt Nicht-Domains ab", () => {
    for (const customDomain of ["nodots", "http://x.de", "a..b", ""]) {
      expect(workspaceDomainSchema.safeParse({ customDomain }).success).toBe(
        false
      );
    }
  });
});
