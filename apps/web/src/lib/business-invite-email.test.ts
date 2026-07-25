import { describe, expect, it } from "vitest";
import { renderBusinessInviteEmail } from "./business-invite-email";

describe("renderBusinessInviteEmail", () => {
  const input = {
    ownerName: "Acme GmbH",
    courseTitle: "React für Einsteiger",
    loginUrl: "https://learnsphere.one/de/anmelden",
    locale: "de" as const,
  };

  it("nennt Einlader, Kurs und den Zugangs-Button", () => {
    const { subject, html, text } = renderBusinessInviteEmail(input);
    expect(subject).toContain("React für Einsteiger");
    expect(html).toContain("Acme GmbH");
    expect(html).toContain("React für Einsteiger");
    expect(html).toContain(`href="${input.loginUrl}"`);
    expect(text).toContain(input.loginUrl);
  });

  it("trägt die LearnSphere-Wortmarke im Kopf", () => {
    const { html } = renderBusinessInviteEmail(input);
    expect(html).toContain("Learn<span");
  });

  it("escaped Einlader- und Kurstitel gegen HTML-Einschleusen", () => {
    const { html, subject } = renderBusinessInviteEmail({
      ...input,
      ownerName: "<script>x</script>",
      courseTitle: "<b>Böse</b>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Böse</b>");
    // Klartext-Betreff bleibt unescaped lesbar
    expect(subject).toContain("<b>Böse</b>");
  });

  it("weist auf No-Reply hin und existiert in beiden Sprachen", () => {
    expect(renderBusinessInviteEmail(input).html).toContain(
      "nicht beantwortet"
    );
    const en = renderBusinessInviteEmail({ ...input, locale: "en" });
    expect(en.html).toContain("cannot be answered");
    expect(en.subject).toContain("React für Einsteiger");
  });
});
