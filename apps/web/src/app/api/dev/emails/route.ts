import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { buildEmail, type EmailContent } from "@/lib/email-template";

/**
 * Vorschau aller Transaktions-Mails – NUR in der Entwicklung.
 *
 * So lassen sich die Mails im Browser ansehen, ohne einen Mailserver oder
 * echte Registrierungen: Der GET liefert die fertige HTML-Fassung genau so,
 * wie sie verschickt würde. In Produktion antwortet die Route mit 404, damit
 * sie nirgends erreichbar ist.
 *
 * Aufruf (Dev):
 *   /api/dev/emails                  → Übersicht mit Links
 *   /api/dev/emails?type=verify&lang=de
 *   /api/dev/emails?type=reset&lang=en
 *   /api/dev/emails?type=newsletter
 *   /api/dev/emails?type=waitlist
 */

const TYPES = ["verify", "reset", "newsletter", "waitlist"] as const;
type MailType = (typeof TYPES)[number];

const DEMO_URL = "https://learnsphere.one/de/reset-password?token=demo-token-123";
const DEMO_TITLE = "Filmwissen: Der Untergang";

async function contentFor(
  type: MailType,
  locale: string
): Promise<EmailContent> {
  const t = await getTranslations({ locale, namespace: `mail.${type}` });
  const base = {
    locale,
    preview: t("preview"),
    heading: t("heading"),
    button: { label: t("button"), url: DEMO_URL },
    note: t("note"),
  };
  if (type === "waitlist") {
    return {
      ...base,
      heading: t("heading"),
      paragraphs: [t("intro", { title: DEMO_TITLE })],
    };
  }
  return { ...base, paragraphs: [t("intro")] };
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const lang = params.get("lang") === "en" ? "en" : "de";

  if (type && TYPES.includes(type as MailType)) {
    const { html } = buildEmail(await contentFor(type as MailType, lang));
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Übersicht: jede Mail in beiden Sprachen verlinkt
  const rows = TYPES.flatMap((mail) =>
    ["de", "en"].map(
      (l) =>
        `<li><a href="/api/dev/emails?type=${mail}&lang=${l}" target="preview">${mail} · ${l}</a></li>`
    )
  ).join("");

  const index = `<!doctype html><html><head><meta charset="utf-8">
<title>E-Mail-Vorschau (Dev)</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;display:grid;grid-template-columns:220px 1fr;height:100vh}
  nav{background:#07080F;color:#EDEDF2;padding:20px;overflow:auto}
  nav h1{font-size:15px;letter-spacing:.1em;text-transform:uppercase;color:#A7A9BC}
  nav ul{list-style:none;padding:0;display:grid;gap:6px}
  nav a{color:#C8FF4D;text-decoration:none;font-family:monospace;font-size:13px}
  nav a:hover{text-decoration:underline}
  iframe{border:0;width:100%;height:100%}
</style></head>
<body>
  <nav><h1>E-Mail-Vorschau</h1><ul>${rows}</ul></nav>
  <iframe name="preview" src="/api/dev/emails?type=verify&lang=de"></iframe>
</body></html>`;

  return new NextResponse(index, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
