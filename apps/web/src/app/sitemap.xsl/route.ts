import { NextResponse } from "next/server";
import { getSitemapContext } from "@/lib/services/sitemap-context";
import { theme } from "@/styles/theme";
import { tenantColorOverride, withAlpha } from "@/lib/tenant-theme";

/**
 * /sitemap.xsl – die „hübsche" Browser-Ansicht der Sitemap (Night-Observatory-
 * Look). Früher eine statische Datei; jetzt host-abhängig, damit auf einem
 * Whitelabel-Mandanten Farbschema UND Marke zum Portal passen (kein
 * LearnSphere-Leak). Suchmaschinen ignorieren das Stylesheet ohnehin.
 */

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET() {
  const { workspace } = await getSitemapContext();

  const override = workspace
    ? tenantColorOverride({
        accent: workspace.brandColor,
        background: workspace.colorBackground,
        text: workspace.colorText,
        secondary: workspace.colorSecondary,
      })
    : {};
  const c = { ...theme.colors, ...override };
  const brand = escapeHtml(workspace ? workspace.brandName : "LearnSphere");

  const xsl = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Hübsche Browser-Ansicht für /sitemap.xml. Reine Deko: Suchmaschinen lesen das XML. -->
<xsl:stylesheet
  version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="de">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Sitemap · ${brand}</title>
        <style>
          :root {
            --bg: ${c.bgDeep};
            --surface: ${c.bgElevated};
            --elevated: ${c.surfaceHover};
            --border: ${c.border};
            --border-strong: ${c.borderStrong};
            --text: ${c.text};
            --muted: ${c.textMuted};
            --faint: ${c.textFaint};
            --accent: ${c.accent};
            --violet: ${c.violet};
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            background:
              radial-gradient(ellipse 80% 50% at 50% -20%, ${withAlpha(c.violet, 0.14)}, transparent),
              radial-gradient(ellipse 60% 40% at 90% 110%, ${withAlpha(c.accent, 0.05)}, transparent),
              var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 3rem 1rem 4rem;
            line-height: 1.6;
          }
          .shell { max-width: 1040px; margin: 0 auto; }
          .kicker {
            font-size: 0.72rem;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 0.6rem;
          }
          h1 {
            font-family: Georgia, "Times New Roman", serif;
            font-weight: 600;
            font-size: clamp(1.8rem, 5vw, 2.6rem);
            letter-spacing: -0.01em;
          }
          h1 em { color: var(--accent); font-style: italic; }
          .sub { color: var(--muted); font-size: 0.95rem; margin-top: 0.5rem; max-width: 60ch; }
          .stats { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1.6rem 0 2rem; }
          .pill {
            display: inline-flex;
            align-items: baseline;
            gap: 0.45rem;
            padding: 0.45rem 1rem;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: var(--surface);
            font-size: 0.82rem;
            color: var(--muted);
          }
          .pill strong {
            color: var(--accent);
            font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
            font-size: 0.95rem;
          }
          .tablewrap {
            border: 1px solid var(--border);
            border-radius: 18px;
            background: var(--surface);
            overflow-x: auto;
          }
          table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
          thead th {
            text-align: left;
            font-size: 0.7rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: var(--faint);
            padding: 0.9rem 1.1rem;
            border-bottom: 1px solid var(--border-strong);
            white-space: nowrap;
          }
          tbody td {
            padding: 0.65rem 1.1rem;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
          }
          tbody tr:last-child td { border-bottom: 0; }
          tbody tr:hover { background: var(--elevated); }
          td.num {
            color: var(--faint);
            font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
            font-size: 0.78rem;
            text-align: right;
            width: 1%;
          }
          a {
            color: var(--text);
            text-decoration: none;
            font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
            font-size: 0.82rem;
            word-break: break-all;
          }
          a:hover { color: var(--accent); }
          .langs { white-space: nowrap; }
          .lang {
            display: inline-block;
            padding: 0.1rem 0.55rem;
            margin-right: 0.3rem;
            border: 1px solid ${withAlpha(c.violet, 0.4)};
            border-radius: 999px;
            background: ${withAlpha(c.violet, 0.14)};
            color: var(--violet);
            font-size: 0.7rem;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          td.mod {
            color: var(--muted);
            font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
            font-size: 0.78rem;
            white-space: nowrap;
          }
          .foot { margin-top: 1.4rem; color: var(--faint); font-size: 0.78rem; }
        </style>
      </head>
      <body>
        <div class="shell">
          <p class="kicker">${brand}</p>
          <h1>Sitemap<em>.</em></h1>

          <xsl:if test="s:sitemapindex">
            <p class="sub">
              Sitemap-Index: eine Sprach-Sitemap pro verfügbarer Sprache.
            </p>

            <div class="stats">
              <span class="pill"><strong><xsl:value-of select="count(s:sitemapindex/s:sitemap)"/></strong> Sprach-Sitemaps</span>
            </div>

            <div class="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Sitemap</th>
                  </tr>
                </thead>
                <tbody>
                  <xsl:for-each select="s:sitemapindex/s:sitemap">
                    <tr>
                      <td class="num"><xsl:value-of select="position()"/></td>
                      <td>
                        <a>
                          <xsl:attribute name="href"><xsl:value-of select="s:loc"/></xsl:attribute>
                          <xsl:value-of select="s:loc"/>
                        </a>
                      </td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </div>
          </xsl:if>

          <xsl:if test="s:urlset">
            <p class="sub">
              Alle öffentlichen Seiten dieser Sprache – mit hreflang-Verweisen
              auf die übrigen Sprachversionen.
            </p>

            <div class="stats">
              <span class="pill"><strong><xsl:value-of select="count(s:urlset/s:url)"/></strong> URLs</span>
              <span class="pill"><strong><xsl:value-of select="count(s:urlset/s:url/s:lastmod)"/></strong> mit Änderungsdatum</span>
              <span class="pill"><strong><xsl:value-of select="count(s:urlset/s:url[1]/xhtml:link)"/></strong> Sprachen</span>
            </div>

            <div class="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>URL</th>
                    <th>Sprachen</th>
                    <th>Zuletzt geändert</th>
                  </tr>
                </thead>
                <tbody>
                  <xsl:for-each select="s:urlset/s:url">
                    <tr>
                      <td class="num"><xsl:value-of select="position()"/></td>
                      <td>
                        <a>
                          <xsl:attribute name="href"><xsl:value-of select="s:loc"/></xsl:attribute>
                          <xsl:value-of select="s:loc"/>
                        </a>
                      </td>
                      <td class="langs">
                        <xsl:for-each select="xhtml:link">
                          <span class="lang"><xsl:value-of select="@hreflang"/></span>
                        </xsl:for-each>
                      </td>
                      <td class="mod">
                        <xsl:choose>
                          <xsl:when test="s:lastmod">
                            <xsl:value-of select="substring(s:lastmod, 1, 10)"/>
                          </xsl:when>
                          <xsl:otherwise>–</xsl:otherwise>
                        </xsl:choose>
                      </td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </div>
          </xsl:if>

          <p class="foot">
            Generiert von ${brand} · valide nach sitemaps.org-Schema 0.9 ·
            hreflang-Alternates je Sprachversion
          </p>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;

  return new NextResponse(xsl, {
    headers: { "Content-Type": "text/xsl; charset=utf-8" },
  });
}
