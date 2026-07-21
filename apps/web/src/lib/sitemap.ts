import { routing } from "@/i18n/routing";

/**
 * Sitemap-Logik (pur, testbar): baut aus statischen Routen, veröffentlichten
 * Kursen und Creator-Storefronts die Einträge inkl. de/en-hreflang-Alternates.
 * Die IO-Hülle (DB-Query) liegt in src/app/sitemap.ts.
 */

/** Öffentliche, indexierbare Seiten (interne Routen-Namen) */
export const SITEMAP_STATIC_PATHS = [
  "/",
  "/courses",
  "/pricing",
  "/for-creators",
  "/affiliate",
  "/roadmap",
  "/api-docs",
  "/verify",
  "/imprint",
  "/privacy",
  "/terms",
  "/accessibility",
] as const;

type Locale = (typeof routing.locales)[number];

/**
 * Interne Route → externe, lokalisierte URL (Pfad-Anteil inkl. Locale-Präfix).
 * Nutzt dieselbe pathnames-Tabelle wie das Routing – Sitemap und echte
 * Routen können nicht auseinanderlaufen.
 */
export function localizePath(
  internal: string,
  locale: Locale,
  params?: Record<string, string>
): string {
  const entry = (
    routing.pathnames as Record<string, string | Record<Locale, string>>
  )[internal];
  if (!entry) {
    throw new Error(`Unbekannte Route für die Sitemap: ${internal}`);
  }
  let path = typeof entry === "string" ? entry : entry[locale];
  for (const [key, value] of Object.entries(params ?? {})) {
    path = path.replace(`[${key}]`, encodeURIComponent(value));
  }
  return `/${locale}${path === "/" ? "" : path}`;
}

export interface SitemapEntry {
  url: string;
  lastModified?: Date;
  alternates: { languages: Record<string, string> };
}

export interface SitemapCourse {
  slug: string;
  updatedAt: Date;
}

export interface SitemapCreator {
  handle: string;
}

/**
 * Google-Empfehlung für mehrsprachige Sitemaps: JEDE Sprachversion als
 * eigener <url>-Eintrag, jeweils mit der kompletten (wechselseitigen)
 * hreflang-Gruppe. Mit `only` entstehen nur die <loc>-Einträge dieser
 * Sprache (für die Sprach-Sitemaps des Index) – die Gruppe bleibt komplett.
 */
function entriesFor(
  baseUrl: string,
  internal: string,
  params?: Record<string, string>,
  lastModified?: Date,
  only?: Locale
): SitemapEntry[] {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [
      locale,
      `${baseUrl}${localizePath(internal, locale, params)}`,
    ])
  );
  const locales = only ? [only] : routing.locales;
  return locales.map((locale) => ({
    url: languages[locale],
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages },
  }));
}

export function buildSitemap(input: {
  baseUrl: string;
  courses: SitemapCourse[];
  creators: SitemapCreator[];
  /** nur die <loc>-Einträge dieser Sprache (Sprach-Sitemap im Index) */
  locale?: Locale;
  /** <lastmod> für statische Seiten (Build-/Deploy-Zeitpunkt) */
  staticLastModified?: Date;
}): SitemapEntry[] {
  return [
    ...SITEMAP_STATIC_PATHS.flatMap((path) =>
      entriesFor(
        input.baseUrl,
        path,
        undefined,
        input.staticLastModified,
        input.locale
      )
    ),
    ...input.courses.flatMap((course) =>
      entriesFor(
        input.baseUrl,
        "/courses/[slug]",
        { slug: course.slug },
        course.updatedAt,
        input.locale
      )
    ),
    ...input.creators.flatMap((creator) =>
      entriesFor(
        input.baseUrl,
        "/c/[handle]",
        { handle: creator.handle },
        undefined,
        input.locale
      )
    ),
  ];
}

/* ---------- Sitemap-Index: eine Sprach-Sitemap pro Locale ---------- */

export interface SitemapIndexEntry {
  url: string;
}

/** /sitemap.xml verweist auf eine Datei je Sprache – neue Sprachen im
    Routing erscheinen hier automatisch. */
export function sitemapIndexEntries(baseUrl: string): SitemapIndexEntry[] {
  return routing.locales.map((locale) => ({
    url: `${baseUrl}/sitemaps/${locale}.xml`,
  }));
}

/** Build-Zeitstempel (ISO-String aus der Umgebung) → Date, sonst undefined. */
export function parseBuildTimestamp(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** "de.xml" → "de" (nur bekannte Locales, sonst null → 404). */
export function parseSitemapLocale(file: string): Locale | null {
  const match = /^([a-z]{2}(?:-[A-Z]{2})?)\.xml$/.exec(file);
  if (!match) return null;
  const locale = match[1];
  return (routing.locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : null;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Einträge als Sitemap-XML serialisieren – mit Verweis auf /sitemap.xsl:
 * Browser zeigen dadurch eine gestylte Ansicht, Suchmaschinen ignorieren
 * die Processing Instruction und lesen das unveränderte, valide XML.
 */
export function renderSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const alternates = Object.entries(entry.alternates.languages)
        .map(
          ([lang, href]) =>
            `    <xhtml:link rel="alternate" hreflang="${escapeXml(lang)}" href="${escapeXml(href)}"/>`
        )
        .join("\n");
      return [
        "  <url>",
        `    <loc>${escapeXml(entry.url)}</loc>`,
        ...(entry.lastModified
          ? [`    <lastmod>${entry.lastModified.toISOString()}</lastmod>`]
          : []),
        alternates,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** Index-Datei serialisieren (gleiches Stylesheet wie die Sprach-Sitemaps). */
export function renderSitemapIndexXml(entries: SitemapIndexEntry[]): string {
  const sitemaps = entries
    .map((entry) =>
      [
        "  <sitemap>",
        `    <loc>${escapeXml(entry.url)}</loc>`,
        "  </sitemap>",
      ].join("\n")
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    sitemaps,
    "</sitemapindex>",
    "",
  ].join("\n");
}

/**
 * Nicht-öffentliche Bereiche für robots.txt – in beiden Sprachvarianten,
 * da die externen Pfade lokalisiert sind.
 */
export function robotsDisallowPaths(): string[] {
  const internals = [
    "/creator",
    "/admin",
    "/my-learning",
    "/learn/[slug]",
    "/cart",
    "/profile",
    "/settings",
    "/login",
    "/register",
  ];
  const paths = new Set<string>(["/api/", "/embed/"]);
  for (const internal of internals) {
    for (const locale of routing.locales) {
      // Präfix reicht: "/de/lernen" deckt auch "/de/lernen/kurs-x" ab
      paths.add(localizePath(internal, locale).replace("/[slug]", "") + "/");
    }
  }
  return [...paths].sort();
}
