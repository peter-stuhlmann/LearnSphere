import { describe, expect, it } from "vitest";
import {
  workspaceDomainSchema,
  workspaceLegalSchema,
  workspaceSchema,
  WORKSPACE_RESERVED_SLUGS,
} from "./validation";

const validLegal = {
  operator: "Acme GmbH",
  legalForm: "GmbH",
  street: "Hauptstr. 1",
  zip: "12345",
  city: "Berlin",
  country: "Deutschland",
  email: "INFO@Acme.DE",
  phone: "+49 30 1234567",
  representative: "Max Mustermann",
  vatId: "DE123456789",
  register: "AG Berlin HRB 12345",
};

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

describe("workspaceLegalSchema", () => {
  it("akzeptiert einen vollständigen Datensatz und normalisiert die E-Mail", () => {
    const result = workspaceLegalSchema.safeParse(validLegal);
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe("info@acme.de");
  });

  it("erlaubt leere optionale Felder (Rechtsform, Telefon, USt-IdNr, Register)", () => {
    const result = workspaceLegalSchema.safeParse({
      ...validLegal,
      legalForm: "",
      phone: "",
      vatId: "",
      register: "",
    });
    expect(result.success).toBe(true);
  });

  it("verlangt die Pflichtfelder mit passender Fehlermeldung", () => {
    const cases: Array<[Partial<typeof validLegal>, string]> = [
      [{ operator: "A" }, "legal_operator_required"],
      [{ street: "ab" }, "legal_street_required"],
      [{ zip: "1" }, "legal_zip_required"],
      [{ city: "" }, "legal_city_required"],
      [{ country: "D" }, "legal_country_required"],
      [{ email: "keine-mail" }, "email_invalid"],
      [{ representative: "" }, "legal_representative_required"],
    ];
    for (const [patch, message] of cases) {
      const result = workspaceLegalSchema.safeParse({ ...validLegal, ...patch });
      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0]?.message).toBe(message);
    }
  });
});
