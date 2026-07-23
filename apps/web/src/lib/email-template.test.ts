import { describe, expect, it } from "vitest";
import { buildEmail, type EmailContent } from "./email-template";

const base: EmailContent = {
  locale: "de",
  preview: "Vorschautext",
  heading: "Passwort zurücksetzen",
  paragraphs: ["Erster Absatz.", "Zweiter Absatz."],
  button: { label: "Neues Passwort wählen", url: "https://learnsphere.one/reset?token=abc" },
  note: "Falls du das nicht warst, ignoriere diese Mail.",
};

describe("buildEmail", () => {
  it("liefert HTML und Text mit demselben Wortlaut", () => {
    const { html, text } = buildEmail(base);
    for (const part of [
      base.heading,
      ...base.paragraphs,
      base.button!.label,
      base.button!.url,
      base.note!,
    ]) {
      expect(html).toContain(part.replace(/ü/g, "ü")); // Umlaut unverändert
      expect(text).toContain(part);
    }
  });

  it("bettet den Button-Link auch als Klartext-Fallback ein", () => {
    const { html } = buildEmail(base);
    // Adresse erscheint sowohl im Button als auch als kopierbarer Link
    expect(html.match(/learnsphere\.one\/reset/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("zeigt die Wortmarke mit farbigem Sphere", () => {
    expect(buildEmail(base).html).toContain("Learn<span");
  });

  it("escaped eingebettete Nutzerdaten (kein HTML-Injection)", () => {
    const evil = buildEmail({
      ...base,
      paragraphs: ['<script>alert("x")</script> & mehr'],
    });
    expect(evil.html).not.toContain("<script>alert");
    expect(evil.html).toContain("&lt;script&gt;");
    expect(evil.html).toContain("&amp; mehr");
  });

  it("kommt ohne Button und Notiz aus", () => {
    const { html, text } = buildEmail({
      locale: "de",
      preview: "p",
      heading: "Nur Text",
      paragraphs: ["Ein Absatz."],
    });
    expect(html).toContain("Ein Absatz.");
    expect(html).not.toContain("border-radius:999px;background"); // kein Button
    expect(text).toContain("Nur Text");
  });

  it("rendert Fußzeilen-Links (z. B. Abmelden)", () => {
    const { html, text } = buildEmail({
      ...base,
      footerLinks: [{ label: "Abmelden", url: "https://learnsphere.one/unsub" }],
    });
    expect(html).toContain("Abmelden");
    expect(html).toContain("learnsphere.one/unsub");
    expect(text).toContain("Abmelden: https://learnsphere.one/unsub");
  });

  it("wählt die Sprache der festen Bausteine, mit Fallback auf Englisch", () => {
    expect(buildEmail(base).html).toContain("Falls der Button");
    expect(buildEmail({ ...base, locale: "en" }).html).toContain(
      "If the button doesn't work"
    );
    // unbekannte Sprache → englische Bausteine
    expect(buildEmail({ ...base, locale: "fr" }).html).toContain(
      "If the button doesn't work"
    );
  });
});
