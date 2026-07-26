import { describe, expect, it } from "vitest";
import { renderWhitelabelInviteEmail } from "./business-invite-email";

describe("renderWhitelabelInviteEmail", () => {
  const out = renderWhitelabelInviteEmail({
    brandName: "Acme Academy",
    accentColor: "#FF8800",
    courseTitle: "TypeScript Grundlagen",
    loginUrl: "https://academy.acme.com/de/anmelden",
    locale: "de",
  });

  it("nennt die Marke und niemals LearnSphere", () => {
    for (const part of [out.subject, out.html, out.text]) {
      expect(part.toLowerCase()).not.toContain("learnsphere");
      expect(part).toContain("Acme Academy");
    }
  });

  it("verlinkt auf die Portal-Adresse", () => {
    expect(out.html).toContain("https://academy.acme.com/de/anmelden");
    expect(out.text).toContain("https://academy.acme.com/de/anmelden");
  });

  it("nutzt die Akzentfarbe des Portals", () => {
    expect(out.html).toContain("#FF8800");
  });

  it("fällt bei ungültiger Farbe auf ein neutrales Blau zurück", () => {
    const x = renderWhitelabelInviteEmail({
      brandName: "Brand",
      accentColor: "rot",
      courseTitle: "Kurs",
      loginUrl: "https://x.de",
      locale: "en",
    });
    expect(x.html).toContain("#4DD8FF");
  });

  it("nutzt die Sie-Anrede bei formal=true (Deutsch)", () => {
    const formal = renderWhitelabelInviteEmail({
      brandName: "Acme Academy",
      courseTitle: "TypeScript",
      loginUrl: "https://academy.acme.com/de/anmelden",
      locale: "de",
      formal: true,
    });
    expect(formal.text).toMatch(/Melden Sie sich|wurden für den Kurs/);
    expect(formal.text.toLowerCase()).not.toMatch(/\bmelde dich\b|\bdu wurdest\b/);
  });

  it("escaped HTML in Marke und Kurstitel", () => {
    const x = renderWhitelabelInviteEmail({
      brandName: "<b>x</b>",
      accentColor: null,
      courseTitle: "<i>c</i>",
      loginUrl: "https://x.de",
      locale: "en",
    });
    expect(x.html).not.toContain("<b>x</b>");
    expect(x.html).toContain("&lt;b&gt;");
  });
});
