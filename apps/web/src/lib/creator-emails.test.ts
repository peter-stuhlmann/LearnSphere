import { describe, expect, it } from "vitest";
import {
  buildUnsubscribeUrl,
  formatCourseList,
  renderCreatorEmail,
  unsubscribeToken,
  validateCreatorCampaign,
  validateScheduleAt,
  verifyUnsubscribeToken,
} from "./creator-emails";

describe("formatCourseList", () => {
  it("liefert für eine leere Liste einen leeren String", () => {
    expect(formatCourseList([], "de")).toBe("");
  });

  it("nennt einen Kurs direkt", () => {
    expect(formatCourseList(["React"], "de")).toBe("React");
  });

  it("verbindet zwei Kurse mit und/and", () => {
    expect(formatCourseList(["React", "Vue"], "de")).toBe("React und Vue");
    expect(formatCourseList(["React", "Vue"], "en")).toBe("React and Vue");
  });

  it("trennt ab drei Kursen mit Kommas und schließt mit und", () => {
    expect(formatCourseList(["A", "B", "C"], "de")).toBe("A, B und C");
    expect(formatCourseList(["A", "B", "C", "D"], "en")).toBe(
      "A, B, C and D"
    );
  });
});

describe("validateCreatorCampaign", () => {
  const valid = {
    subject: "Neuer Kurs online!",
    html: "<p>Hallo, es gibt Neuigkeiten.</p>",
    allCourses: true,
    courseIds: [] as string[],
  };

  it("akzeptiert eine vollständige Kampagne", () => {
    expect(validateCreatorCampaign(valid)).toEqual({ ok: true });
  });

  it("verlangt einen Betreff mit mindestens 3 Zeichen", () => {
    expect(validateCreatorCampaign({ ...valid, subject: "  " })).toEqual({
      ok: false,
      error: "subject_required",
    });
    expect(validateCreatorCampaign({ ...valid, subject: "Hi" })).toEqual({
      ok: false,
      error: "subject_required",
    });
  });

  it("begrenzt den Betreff auf 150 Zeichen", () => {
    expect(
      validateCreatorCampaign({ ...valid, subject: "x".repeat(151) })
    ).toEqual({ ok: false, error: "subject_too_long" });
  });

  it("verlangt echten Inhalt – leere Tags zählen nicht", () => {
    expect(validateCreatorCampaign({ ...valid, html: "" })).toEqual({
      ok: false,
      error: "content_required",
    });
    expect(
      validateCreatorCampaign({ ...valid, html: "<p>  </p><p><br></p>" })
    ).toEqual({ ok: false, error: "content_required" });
  });

  it("begrenzt den Inhalt auf 100.000 Zeichen", () => {
    expect(
      validateCreatorCampaign({
        ...valid,
        html: `<p>${"x".repeat(100_001)}</p>`,
      })
    ).toEqual({ ok: false, error: "content_too_long" });
  });

  it("verlangt bei Kurs-Auswahl mindestens einen Kurs", () => {
    expect(
      validateCreatorCampaign({ ...valid, allCourses: false, courseIds: [] })
    ).toEqual({ ok: false, error: "courses_required" });
    expect(
      validateCreatorCampaign({
        ...valid,
        allCourses: false,
        courseIds: ["c1"],
      })
    ).toEqual({ ok: true });
  });
});

describe("validateScheduleAt", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("akzeptiert null – sofort senden", () => {
    expect(validateScheduleAt(null, now)).toEqual({ ok: true, date: null });
  });

  it("akzeptiert einen Zeitpunkt ab 2 Minuten in der Zukunft", () => {
    const result = validateScheduleAt("2026-07-24T12:05:00.000Z", now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.date?.toISOString()).toBe("2026-07-24T12:05:00.000Z");
    }
  });

  it("lehnt Vergangenheit und zu nahe Zeitpunkte ab", () => {
    expect(validateScheduleAt("2026-07-24T11:00:00.000Z", now)).toEqual({
      ok: false,
      error: "schedule_past",
    });
    expect(validateScheduleAt("2026-07-24T12:01:00.000Z", now)).toEqual({
      ok: false,
      error: "schedule_past",
    });
  });

  it("lehnt unlesbare Werte ab", () => {
    expect(validateScheduleAt("kein-datum", now)).toEqual({
      ok: false,
      error: "schedule_invalid",
    });
  });

  it("lehnt mehr als ein Jahr Vorlauf ab", () => {
    expect(validateScheduleAt("2027-08-01T12:00:00.000Z", now)).toEqual({
      ok: false,
      error: "schedule_too_far",
    });
  });
});

describe("renderCreatorEmail", () => {
  const input = {
    subject: "Rabatt für dich",
    bodyHtml: "<p>Nur diese Woche: <strong>20 %</strong> sparen.</p>",
    creatorName: "Peters Akademie",
    courseTitles: ["React für Einsteiger"],
    locale: "de" as const,
    unsubscribeUrl: "https://learnsphere.one/de/e-mails/abbestellen?t=abc",
  };

  it("nennt im Kopf den Kurs des Empfängers (Singular)", () => {
    const { html } = renderCreatorEmail(input);
    expect(html).toContain(
      "Peters Akademie – Ersteller des Kurses React für Einsteiger"
    );
  });

  it("zählt mehrere eingeschriebene Kurse auf (Plural, beide Sprachen)", () => {
    const de = renderCreatorEmail({
      ...input,
      courseTitles: ["React", "Vue", "Svelte"],
    }).html;
    expect(de).toContain(
      "Peters Akademie – Ersteller der Kurse React, Vue und Svelte"
    );
    const en = renderCreatorEmail({
      ...input,
      locale: "en",
      courseTitles: ["React", "Vue"],
    }).html;
    expect(en).toContain(
      "Peters Akademie – creator of the courses React and Vue"
    );
  });

  it("lässt die Kurszeile ohne Titel weg (nur der Name bleibt)", () => {
    const { html } = renderCreatorEmail({ ...input, courseTitles: [] });
    expect(html).toContain("Peters Akademie");
    expect(html).not.toContain("Ersteller");
  });

  it("escaped Kurstitel im Kopf", () => {
    const { html } = renderCreatorEmail({
      ...input,
      courseTitles: ["<b>Böse</b>"],
    });
    expect(html).not.toContain("<b>Böse</b>");
    expect(html).toContain("&lt;b&gt;Böse&lt;/b&gt;");
  });

  it("bettet Betreff, Inhalt und Creator-Name ins HTML ein", () => {
    const { html } = renderCreatorEmail(input);
    expect(html).toContain("Rabatt für dich");
    expect(html).toContain("<strong>20 %</strong>");
    expect(html).toContain("Peters Akademie");
  });

  it("zeigt die LearnSphere-Wortmarke im Kopf – vor dem Betreff", () => {
    const { html } = renderCreatorEmail(input);
    const wordmarkIndex = html.indexOf("Learn<span");
    const headingIndex = html.indexOf("<h1");
    expect(wordmarkIndex).toBeGreaterThan(-1);
    expect(headingIndex).toBeGreaterThan(-1);
    expect(wordmarkIndex).toBeLessThan(headingIndex);
  });

  it("escaped Betreff und Creator-Name (kein HTML-Einschleusen)", () => {
    const { html } = renderCreatorEmail({
      ...input,
      subject: "<script>alert(1)</script>",
      creatorName: "<img src=x>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("entfernt gefährliches Markup aus dem Inhalt (Sanitizer läuft)", () => {
    const { html } = renderCreatorEmail({
      ...input,
      bodyHtml: '<p>ok</p><script>alert(1)</script><img src="x" onerror="y">',
    });
    expect(html).not.toContain("script>");
    expect(html).not.toContain("onerror");
    expect(html).toContain("ok");
  });

  it("verlinkt den Abmeldelink im Footer (HTML und Klartext)", () => {
    const { html, text } = renderCreatorEmail(input);
    expect(html).toContain(`href="${input.unsubscribeUrl}"`);
    expect(html).toContain("abbestellen");
    expect(text).toContain(input.unsubscribeUrl);
  });

  it("escaped die Abmelde-URL im HTML-Attribut", () => {
    const { html } = renderCreatorEmail({
      ...input,
      unsubscribeUrl: 'https://x.test/?a=1&b="<script>',
    });
    expect(html).toContain("&amp;b=&quot;&lt;script&gt;");
  });

  it("erzeugt eine Klartext-Fassung ohne Tags", () => {
    const { text } = renderCreatorEmail(input);
    expect(text).toContain("Nur diese Woche");
    expect(text).not.toContain("<strong>");
  });

  it("weist im Footer auf No-Reply hin (beide Sprachen)", () => {
    expect(renderCreatorEmail(input).html).toContain("nicht beantwortet");
    expect(
      renderCreatorEmail({ ...input, locale: "en" }).html
    ).toContain("cannot be answered");
  });
});

describe("renderCreatorEmail – E-Mail-Blöcke", () => {
  const base = {
    subject: "Blöcke",
    creatorName: "Peters Akademie",
    courseTitles: [] as string[],
    locale: "de" as const,
    unsubscribeUrl: "https://x.test/u",
    baseUrl: "https://learnsphere.one",
  };
  const course = {
    slug: "react-kurs",
    title: "React & Friends",
    coverImage: "/uploads/u1/cover.jpg",
    priceCents: 1999,
    currency: "EUR",
  };
  const courseDiv = (courses: unknown, columns = 2) =>
    `<div data-type="course-grid" data-columns="${columns}" data-courses="${JSON.stringify(
      courses
    ).replace(/"/g, "&quot;")}"></div>`;

  it("rendert Kurs-Cards als verlinkte Tabelle mit Preis und Cover", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: `<p>Hi</p>${courseDiv([course])}`,
    });
    expect(html).toContain("React &amp; Friends");
    expect(html).toContain(
      'href="https://learnsphere.one/de/kurse/react-kurs"'
    );
    expect(html).toContain(
      'src="https://learnsphere.one/uploads/u1/cover.jpg"'
    );
    expect(html).toContain("19,99");
    expect(html).not.toContain("data-type");
  });

  it("verteilt Kurse gemäß Spaltenzahl auf Zeilen", () => {
    const four = [1, 2, 3, 4].map((i) => ({ ...course, slug: `k${i}`, title: `K${i}` }));
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: courseDiv(four, 2),
    });
    // 4 Kurse in 2 Spalten → 2 Zeilen im Kurs-Grid
    const gridRows = html.match(/data-grid-row/g) ?? [];
    expect(gridRows).toHaveLength(2);
  });

  it("wirft kaputte oder fremde Block-Daten still raus", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml:
        '<div data-type="course-grid" data-columns="2" data-courses="kein-json"></div>' +
        '<div data-type="unbekannt"></div><p>bleibt</p>',
    });
    expect(html).toContain("bleibt");
    expect(html).not.toContain("data-type");
    expect(html).not.toContain("kein-json");
  });

  it("lässt nur sichere Kurs-Links und Cover zu (Slug-/URL-Prüfung)", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: courseDiv([
        { ...course, slug: '"><script>', coverImage: "javascript:alert(1)" },
      ]),
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
  });

  it("rendert ein Bild-Grid mit absoluten URLs und filtert unsichere", () => {
    const images = ["/uploads/u1/a.jpg", "https://cdn.test/b.png", "javascript:x"];
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: `<div data-type="image-grid" data-images="${JSON.stringify(
        images
      ).replace(/"/g, "&quot;")}"></div>`,
    });
    expect(html).toContain('src="https://learnsphere.one/uploads/u1/a.jpg"');
    expect(html).toContain('src="https://cdn.test/b.png"');
    expect(html).not.toContain("javascript:x");
  });

  it("rendert den CTA-Button mit Label und Ziel; ohne URL entfällt er", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml:
        '<div data-type="cta-button" data-label="Jetzt starten" data-url="https://learnsphere.one/de/kurse"></div>',
    });
    expect(html).toContain(">Jetzt starten</a>");
    expect(html).toContain('href="https://learnsphere.one/de/kurse"');

    const without = renderCreatorEmail({
      ...base,
      bodyHtml: '<div data-type="cta-button" data-label="Ohne Ziel"></div>',
    }).html;
    expect(without).not.toContain("Ohne Ziel");
  });

  it("akzeptiert reine Block-Mails als Inhalt (Validierung)", () => {
    expect(
      validateCreatorCampaign({
        subject: "Nur Blöcke",
        html: courseDiv([course]),
        allCourses: true,
        courseIds: [],
      })
    ).toEqual({ ok: true });
  });

  it("kappt Kurs-Grids bei 9 Karten", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...course,
      slug: `kurs-${i}`,
      title: `Kurs ${i}`,
    }));
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: courseDiv(many, 3),
    });
    expect(html).toContain("Kurs 8");
    expect(html).not.toContain("Kurs 9");
  });

  it("füllt unvollständige Zeilen mit Leerzellen auf", () => {
    const three = [1, 2, 3].map((i) => ({ ...course, slug: `k${i}`, title: `K${i}` }));
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: courseDiv(three, 2),
    });
    expect(html).toContain('<td style="padding:6px;"></td>');
  });

  it("zeigt ohne Cover das Platzhalter-Bild der Website", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: courseDiv([{ slug: "nur-titel", title: "Nur Titel" }]),
    });
    expect(html).toContain("Nur Titel");
    expect(html).toContain(
      'src="https://learnsphere.one/email/cover-placeholder.png"'
    );
  });

  it("zeigt mit Cover das Kursbild statt des Platzhalters", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: courseDiv([course]),
    });
    expect(html).toContain(
      'src="https://learnsphere.one/uploads/u1/cover.jpg"'
    );
    expect(html).not.toContain("cover-placeholder.png");
  });

  it("nutzt EUR als Fallback-Währung und den en-Kurspfad", () => {
    const { html } = renderCreatorEmail({
      ...base,
      locale: "en",
      bodyHtml: courseDiv([
        { slug: "k1", title: "K1", priceCents: 500, currency: 7 },
      ]),
    });
    expect(html).toContain("/en/courses/k1");
    expect(html).toContain("€");
  });

  it("verwirft Nicht-Array-Daten in Kurs- und Bild-Grid", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml:
        '<div data-type="course-grid" data-courses="{&quot;a&quot;:1}"></div>' +
        '<div data-type="image-grid" data-images="{&quot;a&quot;:1}"></div>' +
        '<div data-type="image-grid" data-images="kaputt"></div>',
    });
    expect(html).not.toContain("data-type");
  });

  it("filtert Nicht-Strings und protokoll-relative URLs aus dem Bild-Grid", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: `<div data-type="image-grid" data-images="${JSON.stringify([
        123,
        "//evil.test/x.png",
      ]).replace(/"/g, "&quot;")}"></div>`,
    });
    expect(html).not.toContain("evil.test");
    expect(html).not.toContain("<img");
  });

  it("präfixiert relative CTA-Ziele mit der Basis-URL; leeres Label entfällt", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml:
        '<div data-type="cta-button" data-label="Los" data-url="/de/kurse"></div>' +
        '<div data-type="cta-button" data-label="" data-url="https://x.test"></div>',
    });
    expect(html).toContain('href="https://learnsphere.one/de/kurse"');
    expect(html).not.toContain('href="https://x.test"');
  });

  it("entfernt Grids ohne Daten-Attribute und klemmt absurde Spaltenzahlen", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml:
        '<div data-type="course-grid"></div>' +
        '<div data-type="image-grid"></div>' +
        courseDiv([course], 99),
    });
    expect(html).not.toContain("data-type");
    // 99 Spalten → auf 3 geklemmt → Karte + 2 Füllzellen in einer Zeile
    expect(html).toContain('width="33%"');
  });

  it("fällt ohne Spaltenangabe auf 3 Spalten zurück", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: `<div data-type="course-grid" data-courses="${JSON.stringify([
        course,
      ]).replace(/"/g, "&quot;")}"></div>`,
    });
    expect(html).toContain('width="33%"');
  });

  it("hängt den Affiliate-Code an fremde Kurse an – nie an eigene", () => {
    const { html } = renderCreatorEmail({
      ...base,
      affiliateCode: "AB12CD34",
      bodyHtml: courseDiv([
        { ...course, slug: "fremd", own: false },
        { ...course, slug: "eigen", own: true },
      ]),
    });
    expect(html).toContain(
      'href="https://learnsphere.one/de/kurse/fremd?aff=AB12CD34"'
    );
    expect(html).toContain('href="https://learnsphere.one/de/kurse/eigen"');
    expect(html).not.toContain("eigen?aff");
  });

  it("lässt Kurs-Links ohne Affiliate-Code unangetastet", () => {
    const { html } = renderCreatorEmail({
      ...base,
      bodyHtml: courseDiv([{ ...course, slug: "fremd", own: false }]),
    });
    expect(html).toContain('href="https://learnsphere.one/de/kurse/fremd"');
    expect(html).not.toContain("aff=");
  });

  it("nimmt Kurs-Titel und CTA-Label in die Klartext-Fassung auf", () => {
    const { text } = renderCreatorEmail({
      ...base,
      bodyHtml:
        courseDiv([course]) +
        '<div data-type="cta-button" data-label="Jetzt starten" data-url="https://x.test"></div>',
    });
    expect(text).toContain("React & Friends");
    expect(text).toContain("Jetzt starten");
  });
});

describe("unsubscribeToken", () => {
  const secret = "test-secret";

  it("ist deterministisch für dieselben Eingaben", () => {
    expect(unsubscribeToken("a@b.de", "creator1", secret)).toBe(
      unsubscribeToken("a@b.de", "creator1", secret)
    );
  });

  it("ändert sich mit E-Mail, Creator und Secret", () => {
    const base = unsubscribeToken("a@b.de", "creator1", secret);
    expect(unsubscribeToken("x@b.de", "creator1", secret)).not.toBe(base);
    expect(unsubscribeToken("a@b.de", "creator2", secret)).not.toBe(base);
    expect(unsubscribeToken("a@b.de", "creator1", "other")).not.toBe(base);
  });
});

describe("verifyUnsubscribeToken", () => {
  const secret = "test-secret";

  it("akzeptiert einen gültigen Token", () => {
    const token = unsubscribeToken("a@b.de", "creator1", secret);
    expect(verifyUnsubscribeToken("a@b.de", "creator1", token, secret)).toBe(
      true
    );
  });

  it("lehnt manipulierte Eingaben ab", () => {
    const token = unsubscribeToken("a@b.de", "creator1", secret);
    expect(verifyUnsubscribeToken("x@b.de", "creator1", token, secret)).toBe(
      false
    );
    expect(verifyUnsubscribeToken("a@b.de", "creator1", "kaputt", secret)).toBe(
      false
    );
    expect(verifyUnsubscribeToken("a@b.de", "creator1", "", secret)).toBe(
      false
    );
  });
});

describe("buildUnsubscribeUrl", () => {
  it("nutzt den lokalisierten Pfad je Sprache", () => {
    const base = {
      baseUrl: "https://learnsphere.one",
      email: "a@b.de",
      creatorId: "c1",
      secret: "s",
    };
    expect(buildUnsubscribeUrl({ ...base, locale: "de" })).toContain(
      "/de/e-mails/abbestellen"
    );
    expect(buildUnsubscribeUrl({ ...base, locale: "en" })).toContain(
      "/en/emails/unsubscribe"
    );
  });

  it("baut eine verifizierbare URL mit kodierter E-Mail", () => {
    const url = buildUnsubscribeUrl({
      baseUrl: "https://learnsphere.one",
      locale: "de",
      email: "test+tag@example.com",
      creatorId: "creator1",
      secret: "s",
    });
    const parsed = new URL(url);
    expect(parsed.pathname).toContain("/de/");
    const email = Buffer.from(
      parsed.searchParams.get("e") ?? "",
      "base64url"
    ).toString("utf8");
    expect(email).toBe("test+tag@example.com");
    expect(
      verifyUnsubscribeToken(
        email,
        parsed.searchParams.get("c") ?? "",
        parsed.searchParams.get("t") ?? "",
        "s"
      )
    ).toBe(true);
  });
});
