import { describe, expect, it } from "vitest";
import {
  ACCESSIBILITY_INBOX,
  SUBJECT_PREFIX,
  buildAccessibilityMail,
  buildSubject,
} from "./accessibility-feedback";

const valid = {
  name: "  Alex Berg ",
  email: "  Alex@Example.COM ",
  subject: "Feedback zur Barrierefreiheit",
  message: "Der Fokusrahmen ist auf der Kursseite kaum zu sehen.",
};

describe("buildSubject", () => {
  it("stellt das interne Präfix voran", () => {
    expect(buildSubject("Kontrast zu schwach")).toBe(
      `${SUBJECT_PREFIX}Kontrast zu schwach`
    );
  });

  it("entfernt Zeilenumbrüche (Header-Injection)", () => {
    const subject = buildSubject("Hallo\r\nBcc: opfer@example.com");
    expect(subject).toBe(`${SUBJECT_PREFIX}Hallo Bcc: opfer@example.com`);
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it("kürzt überlange Betreffzeilen", () => {
    const subject = buildSubject("x".repeat(400));
    expect(subject).toBe(`${SUBJECT_PREFIX}${"x".repeat(160)}`);
  });
});

describe("buildAccessibilityMail", () => {
  it("baut die Mail an das Barrierefreiheits-Postfach", () => {
    const result = buildAccessibilityMail(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mail.to).toBe(ACCESSIBILITY_INBOX);
    expect(result.mail.subject).toBe(
      `${SUBJECT_PREFIX}Feedback zur Barrierefreiheit`
    );
    // Adresse normalisiert: getrimmt und klein
    expect(result.mail.replyTo).toBe("alex@example.com");
    expect(result.mail.text).toContain("Name:    Alex Berg");
    expect(result.mail.text).toContain("E-Mail:  alex@example.com");
    expect(result.mail.text).toContain("Der Fokusrahmen");
  });

  it("nimmt die Herkunftsseite auf, wenn sie mitgeliefert wird", () => {
    const result = buildAccessibilityMail({
      ...valid,
      page: "/de/barrierefreiheit",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mail.text).toContain("Seite:   /de/barrierefreiheit");
  });

  it("lässt die Zeile weg, wenn keine Seite mitkommt", () => {
    const result = buildAccessibilityMail(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mail.text).not.toContain("Seite:");
  });

  it.each([
    ["name_required", { name: "   " }],
    ["name_required", { name: "n".repeat(121) }],
    ["email_invalid", { email: "keine-adresse" }],
    ["subject_required", { subject: "  " }],
    ["message_required", { message: "" }],
    ["message_required", { message: "m".repeat(5001) }],
  ] as const)("weist ungültige Eingaben zurück: %s", (error, patch) => {
    const result = buildAccessibilityMail({ ...valid, ...patch });
    expect(result).toEqual({ ok: false, error });
  });

  it("meldet nur den ersten Fehler, wenn mehrere Felder leer sind", () => {
    const result = buildAccessibilityMail({
      name: "",
      email: "",
      subject: "",
      message: "",
    });
    expect(result).toEqual({ ok: false, error: "name_required" });
  });
});
