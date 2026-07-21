import { describe, expect, it } from "vitest";
import {
  buildSitemap,
  localizePath,
  parseBuildTimestamp,
  parseSitemapLocale,
  renderSitemapIndexXml,
  renderSitemapXml,
  robotsDisallowPaths,
  SITEMAP_STATIC_PATHS,
  sitemapIndexEntries,
} from "./sitemap";

const BASE = "https://learnsphere.one";

describe("localizePath", () => {
  it("übersetzt Routen in beide Sprachen", () => {
    expect(localizePath("/courses", "de")).toBe("/de/kurse");
    expect(localizePath("/courses", "en")).toBe("/en/courses");
    expect(localizePath("/", "de")).toBe("/de");
  });

  it("füllt dynamische Parameter und encodiert sie", () => {
    expect(localizePath("/courses/[slug]", "de", { slug: "astro 1" })).toBe(
      "/de/kurse/astro%201"
    );
    expect(localizePath("/c/[handle]", "en", { handle: "jana" })).toBe(
      "/en/c/jana"
    );
  });

  it("wirft bei unbekannten Routen", () => {
    expect(() => localizePath("/gibt-es-nicht", "de")).toThrow(
      /Unbekannte Route/
    );
  });
});

describe("buildSitemap", () => {
  const sitemap = buildSitemap({
    baseUrl: BASE,
    courses: [{ slug: "sternenkunde", updatedAt: new Date("2026-07-01") }],
    creators: [{ handle: "jana" }],
  });

  it("listet jede Seite in BEIDEN Sprachversionen", () => {
    // (statische Seiten + 1 Kurs + 1 Storefront) × 2 Sprachen
    expect(sitemap).toHaveLength((SITEMAP_STATIC_PATHS.length + 2) * 2);
  });

  it("jede Sprachversion trägt die komplette hreflang-Gruppe", () => {
    const group = {
      de: `${BASE}/de/kurse/sternenkunde`,
      en: `${BASE}/en/courses/sternenkunde`,
    };
    const de = sitemap.find((e) => e.url === group.de);
    const en = sitemap.find((e) => e.url === group.en);
    expect(de?.alternates.languages).toEqual(group);
    expect(en?.alternates.languages).toEqual(group);
    expect(de?.lastModified).toEqual(new Date("2026-07-01"));
    expect(en?.lastModified).toEqual(new Date("2026-07-01"));
  });

  it("statische Seiten haben ohne Build-Zeitstempel kein lastModified", () => {
    const home = sitemap.find((e) => e.url === `${BASE}/de`);
    expect(home).toBeDefined();
    expect(home?.lastModified).toBeUndefined();
    expect(home?.alternates.languages.en).toBe(`${BASE}/en`);
  });

  it("statische Seiten übernehmen den Build-Zeitstempel als lastModified", () => {
    const buildTime = new Date("2026-07-13T08:00:00Z");
    const withBuild = buildSitemap({
      baseUrl: BASE,
      courses: [{ slug: "sternenkunde", updatedAt: new Date("2026-07-01") }],
      creators: [],
      staticLastModified: buildTime,
    });
    const home = withBuild.find((e) => e.url === `${BASE}/de`);
    expect(home?.lastModified).toEqual(buildTime);
    // Kurse behalten ihr echtes Änderungsdatum
    const course = withBuild.find((e) =>
      e.url.endsWith("/de/kurse/sternenkunde")
    );
    expect(course?.lastModified).toEqual(new Date("2026-07-01"));
  });

  it("enthält Creator-Storefronts in beiden Sprachen", () => {
    expect(sitemap.some((e) => e.url === `${BASE}/de/c/jana`)).toBe(true);
    expect(sitemap.some((e) => e.url === `${BASE}/en/c/jana`)).toBe(true);
  });

  it("filtert mit locale auf die <loc>-Einträge einer Sprache", () => {
    const en = buildSitemap({
      baseUrl: BASE,
      locale: "en",
      courses: [{ slug: "sternenkunde", updatedAt: new Date("2026-07-01") }],
      creators: [{ handle: "jana" }],
    });
    expect(en).toHaveLength(SITEMAP_STATIC_PATHS.length + 2);
    expect(en.every((e) => e.url.startsWith(`${BASE}/en`))).toBe(true);
    // hreflang-Gruppe bleibt trotzdem komplett (verweist auch auf de)
    expect(en[0]?.alternates.languages.de).toContain(`${BASE}/de`);
  });
});

describe("Sitemap-Index", () => {
  it("listet eine Sprach-Sitemap pro Locale", () => {
    expect(sitemapIndexEntries(BASE)).toEqual([
      { url: `${BASE}/sitemaps/de.xml` },
      { url: `${BASE}/sitemaps/en.xml` },
    ]);
  });

  it("parst Build-Zeitstempel tolerant", () => {
    expect(parseBuildTimestamp("2026-07-13T08:00:00.000Z")).toEqual(
      new Date("2026-07-13T08:00:00.000Z")
    );
    expect(parseBuildTimestamp(undefined)).toBeUndefined();
    expect(parseBuildTimestamp("")).toBeUndefined();
    expect(parseBuildTimestamp("kein datum")).toBeUndefined();
  });

  it("parst Sitemap-Dateinamen nur für bekannte Locales", () => {
    expect(parseSitemapLocale("de.xml")).toBe("de");
    expect(parseSitemapLocale("en.xml")).toBe("en");
    expect(parseSitemapLocale("fr.xml")).toBeNull();
    expect(parseSitemapLocale("de")).toBeNull();
    expect(parseSitemapLocale("..%2Fde.xml")).toBeNull();
  });

  it("rendert einen validen sitemapindex mit Stylesheet-Verweis", () => {
    const xml = renderSitemapIndexXml(sitemapIndexEntries(BASE));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
      true
    );
    expect(xml).toContain(
      '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>'
    );
    expect(xml).toContain(
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
    expect(xml).toContain(`<loc>${BASE}/sitemaps/de.xml</loc>`);
    expect(xml).toContain(`<loc>${BASE}/sitemaps/en.xml</loc>`);
  });
});

describe("renderSitemapXml", () => {
  const xml = renderSitemapXml([
    {
      url: `${BASE}/de`,
      alternates: {
        languages: { de: `${BASE}/de`, en: `${BASE}/en` },
      },
    },
    {
      url: `${BASE}/de/kurse/a&b`,
      lastModified: new Date("2026-07-01T10:00:00.000Z"),
      alternates: { languages: { de: `${BASE}/de/kurse/a&b` } },
    },
  ]);

  it("beginnt mit XML-Deklaration und Stylesheet-Verweis vor dem urlset", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
      true
    );
    const stylesheetAt = xml.indexOf(
      '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>'
    );
    const urlsetAt = xml.indexOf("<urlset");
    expect(stylesheetAt).toBeGreaterThan(0);
    expect(urlsetAt).toBeGreaterThan(stylesheetAt);
  });

  it("deklariert Sitemap- und xhtml-Namespace", () => {
    expect(xml).toContain(
      'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
    );
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it("rendert loc, lastmod und hreflang-Alternates", () => {
    expect(xml).toContain(`<loc>${BASE}/de</loc>`);
    expect(xml).toContain("<lastmod>2026-07-01T10:00:00.000Z</lastmod>");
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="en" href="${BASE}/en"/>`
    );
    // Eintrag ohne lastModified bekommt kein leeres <lastmod>
    const first = xml.slice(0, xml.indexOf("</url>"));
    expect(first).not.toContain("<lastmod>");
  });

  it("escapt Sonderzeichen in URLs (bleibt valides XML)", () => {
    expect(xml).toContain("a&amp;b");
    expect(xml).not.toContain("a&b<");
    // kein un-escaptes & außerhalb von Entities
    expect(/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml)).toBe(false);
  });
});

describe("robotsDisallowPaths", () => {
  const paths = robotsDisallowPaths();

  it("sperrt interne Bereiche in beiden Sprachen", () => {
    expect(paths).toContain("/api/");
    expect(paths).toContain("/embed/");
    expect(paths).toContain("/de/creator/");
    expect(paths).toContain("/de/lernen/");
    expect(paths).toContain("/en/learn/");
    expect(paths).toContain("/de/mein-lernen/");
    expect(paths).toContain("/de/warenkorb/");
    expect(paths).toContain("/en/cart/");
    expect(paths).toContain("/de/admin/");
  });

  it("sperrt keine öffentlichen Seiten", () => {
    expect(paths.some((p) => p.includes("/kurse"))).toBe(false);
    expect(paths.some((p) => p.includes("/preise"))).toBe(false);
  });
});
