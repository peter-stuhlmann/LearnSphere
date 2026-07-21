"use client";

import type { ReactNode } from "react";
import { useLocale } from "next-intl";
import styled from "styled-components";
import { Link } from "@/i18n/navigation";
import { Badge, Container, Kicker, SectionTitle } from "@/components/ui/primitives";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Doc = styled.div`
  max-width: 860px;

  p {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.96rem;
  }

  p + p {
    margin-top: 0.75rem;
  }

  ul {
    padding-left: 1.25rem;
    margin-top: 0.5rem;

    li {
      color: ${({ theme }) => theme.colors.textMuted};
      font-size: 0.94rem;
      margin-top: 0.3rem;
    }
  }

  code {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.85em;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 6px;
    padding: 0.1em 0.4em;
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Lead = styled.p`
  max-width: 62ch;
  margin-top: 1rem;
`;

const TierGrid = styled.div`
  display: grid;
  gap: 1rem;
  margin: 2.5rem 0 1rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const TierCard = styled.a`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface};
  text-decoration: none;
  color: inherit;
  transition: border-color 160ms ease, transform 160ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    transform: translateY(-2px);
  }

  h2 {
    font-size: 1.05rem;
  }

  p {
    font-size: 0.88rem;
  }
`;

const SectionH2 = styled.h2`
  font-size: 1.5rem;
  margin: 3rem 0 0.75rem;
  scroll-margin-top: 100px;
`;

const SectionH3 = styled.h3`
  font-size: 1.1rem;
  margin: 2rem 0 0.5rem;
`;

const EndpointRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin: 1.5rem 0 0.5rem;

  .method {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.25rem 0.6rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: ${({ theme }) => theme.colors.accentSoft};
    color: ${({ theme }) => theme.colors.accent};
    border: 1px solid rgba(200, 255, 77, 0.35);
  }

  .path {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.92rem;
    word-break: break-all;
  }
`;

const CodeBlock = styled.pre`
  margin-top: 0.75rem;
  padding: 1rem 1.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgDeep};
  overflow-x: auto;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.82rem;
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.text};
`;

const ParamTable = styled.table`
  width: 100%;
  margin-top: 0.75rem;
  border-collapse: collapse;
  font-size: 0.88rem;

  th,
  td {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.textMuted};
    vertical-align: top;
  }

  th {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: ${({ theme }) => theme.colors.textFaint};
  }

  td:first-child {
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
  }
`;

const DownloadLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.7rem 1.3rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 3px;
  }
`;

const Callout = styled.div<{ $tone?: "info" | "warn" }>`
  margin-top: 1.25rem;
  padding: 1rem 1.25rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid
    ${({ $tone }) =>
      $tone === "warn" ? "rgba(255, 107, 107, 0.4)" : "rgba(139, 124, 255, 0.4)"};
  background: ${({ theme, $tone }) =>
    $tone === "warn" ? theme.colors.dangerSoft : theme.colors.violetSoft};

  p {
    color: ${({ theme }) => theme.colors.text};
    font-size: 0.9rem;
  }
`;

function Endpoint({ path }: { path: string }) {
  return (
    <EndpointRow>
      <span className="method">GET</span>
      <span className="path">{path}</span>
    </EndpointRow>
  );
}

interface TierInfo {
  id: string;
  title: string;
  badge: string;
  badgeTone?: "success" | "violet" | "muted";
  text: string;
}

function TierCards({ tiers }: { tiers: TierInfo[] }) {
  return (
    <TierGrid>
      {tiers.map((tier) => (
        <TierCard key={tier.id} href={`#${tier.id}`}>
          <Badge $tone={tier.badgeTone}>{tier.badge}</Badge>
          <h2>{tier.title}</h2>
          <p>{tier.text}</p>
        </TierCard>
      ))}
    </TierGrid>
  );
}

const LIST_EXAMPLE = `curl "https://learnsphere.one/api/public/v1/courses?q=react&per=12"`;

const LIST_RESPONSE = `{
  "data": [
    {
      "id": "cm…",
      "slug": "react-fuer-einsteiger",
      "title": "React für Einsteiger",
      "subtitle": "Von null zur ersten App",
      "language": "de",
      "priceCents": 4900,
      "currency": "EUR",
      "creatorName": "Jane Doe",
      "sectionCount": 6,
      "lessonCount": 42,
      "averageRating": 4.8,
      "reviewCount": 31,
      "url": "https://learnsphere.one/de/courses/react-fuer-einsteiger",
      "createdAt": "2026-07-01T09:00:00.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "pages": 1, "per": 12 }
}`;

const CREATOR_EXAMPLE = `curl "https://learnsphere.one/api/v1/courses" \\
  -H "Authorization: Bearer ls_1234…abcd"`;

const ERROR_EXAMPLE = `{ "error": "api_plan_required" }`;

export function ApiDocsView() {
  const locale = useLocale();
  return locale === "en" ? <EnglishDocs /> : <GermanDocs />;
}

function Shell({
  kicker,
  title,
  lead,
  tiers,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  tiers: TierInfo[];
  children: ReactNode;
}) {
  return (
    <Wrap id="main">
      <Container>
        <Doc>
          <Kicker>{kicker}</Kicker>
          <SectionTitle as="h1">{title}</SectionTitle>
          <Lead>{lead}</Lead>
          <TierCards tiers={tiers} />
          {children}
        </Doc>
      </Container>
    </Wrap>
  );
}

function GermanDocs() {
  return (
    <Shell
      kicker="Für Entwickler:innen"
      title="LearnSphere API"
      lead="Drei Zugänge, ein Prinzip: Du bekommst Kursdaten als sauberes JSON über HTTPS. Die öffentliche Katalog-API ist kostenlos, die Creator-API ist Teil des API-Pakets."
      tiers={[
        {
          id: "public",
          title: "Öffentliche Katalog-API",
          badge: "Kostenlos",
          badgeTone: "success",
          text: "Alle Kurse, die im LearnSphere-Shop gelistet sind. Kein API-Key nötig.",
        },
        {
          id: "affiliate",
          title: "Affiliate-API",
          badge: "Für Partner",
          badgeTone: "success",
          text: "Der komplette Katalog mit deinen Provisions-Links – 15 % auf vermittelte Verkäufe.",
        },
        {
          id: "creator",
          title: "Creator-API",
          badge: "API-Paket",
          badgeTone: "violet",
          text: "Deine eigenen Kurse für deinen eigenen Shop – mit API-Key, ab 20 €/Monat.",
        },
      ]}
    >
      <SectionH2 id="basics">Grundlagen</SectionH2>
      <p>
        Alle Endpunkte liefern JSON (UTF-8) und sind nur über HTTPS erreichbar.
        Erfolgreiche Antworten stecken in <code>{`{ "data": … }`}</code>,
        Fehler in <code>{`{ "error": "code" }`}</code> mit passendem
        HTTP-Status. Preise sind immer Cent-Beträge (<code>priceCents</code>),
        damit beim Rechnen keine Rundungsfehler entstehen.
      </p>
      <SectionH3>Versionierung</SectionH3>
      <p>
        Jede API trägt ihre Version im Pfad (<code>/api/public/v1/…</code>,{" "}
        <code>/api/v1/…</code>). Innerhalb einer Version bleiben bestehende
        Felder und ihr Verhalten stabil – es kommen höchstens neue, optionale
        Felder hinzu. Inkompatible Änderungen erscheinen ausschließlich unter
        einer neuen Version (<code>v2</code>), die alte läuft mit
        Vorlaufankündigung weiter. Baue deine Integration deshalb so, dass
        unbekannte zusätzliche Felder ignoriert werden.
      </p>
      <ParamTable>
        <thead>
          <tr>
            <th>Status</th>
            <th>Code</th>
            <th>Bedeutung</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>401</td>
            <td>
              <code>unauthorized</code>
            </td>
            <td>API-Key fehlt, ist ungültig oder wurde widerrufen.</td>
          </tr>
          <tr>
            <td>403</td>
            <td>
              <code>api_plan_required</code>
            </td>
            <td>Der Key gehört zu einem Account ohne aktives API-Paket.</td>
          </tr>
          <tr>
            <td>404</td>
            <td>
              <code>not_found</code>
            </td>
            <td>Kurs existiert nicht oder ist nicht (mehr) öffentlich.</td>
          </tr>
          <tr>
            <td>429</td>
            <td>
              <code>rate_limited</code>
            </td>
            <td>Zu viele Anfragen – kurz warten und erneut versuchen.</td>
          </tr>
        </tbody>
      </ParamTable>

      <SectionH2 id="public">1. Öffentliche Katalog-API (kostenlos)</SectionH2>
      <p>
        Ohne Anmeldung und ohne Key. Sie liefert ausschließlich Kurse, die auf
        LearnSphere veröffentlicht <em>und</em> im Shop gelistet sind – also
        genau das, was auch auf der Kurse-Seite zu sehen ist. Kurse, die ein
        Creator nur über eigene Kanäle vertreibt, tauchen hier nicht auf.
      </p>
      <Endpoint path="/api/public/v1/courses" />
      <ParamTable>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Bedeutung</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>q</td>
            <td>Suchbegriff, sucht in Titel und Untertitel.</td>
          </tr>
          <tr>
            <td>page</td>
            <td>Seite, ab 1 (Standard 1).</td>
          </tr>
          <tr>
            <td>per</td>
            <td>Treffer pro Seite, 1–48 (Standard 12).</td>
          </tr>
        </tbody>
      </ParamTable>
      <CodeBlock>{LIST_EXAMPLE}</CodeBlock>
      <CodeBlock>{LIST_RESPONSE}</CodeBlock>
      <Endpoint path="/api/public/v1/courses/{slug}" />
      <p>
        Kursdetail inklusive Beschreibung und Curriculum-Metadaten (Abschnitte,
        Lektionstitel, Dauer, Vorschau-Flag). Kursinhalte selbst – Videos,
        Dateien, Texte – gibt es hier bewusst nicht.
      </p>
      <p>
        Rate-Limit: <strong>60 Anfragen pro Minute und IP</strong>. Antworten
        dürfen bis zu 60 Sekunden gecacht werden.
      </p>

      <SectionH2 id="affiliate">2. Affiliate-API</SectionH2>
      <p>
        Für Mitglieder des{" "}
        <Link href="/affiliate">Partnerprogramms</Link>: der komplette
        Shop-Katalog mit deinen persönlichen Provisions-Links. Käufe über
        diese Links bringen dir <strong>15 % Provision</strong> – gültig für
        jeden Kurskauf innerhalb von 7 Tagen nach dem Klick.
      </p>
      <Endpoint path="/api/v1/affiliate/courses?affiliate=true" />
      <p>
        Auth: Bearer-API-Key (wie bei der Creator-API; ein API-Paket ist
        dafür <em>nicht</em> nötig, nur die Programm-Mitgliedschaft). Der
        Parameter <code>affiliate=true</code> ist Pflicht für die Provision:
        Nur dann tragen die zurückgegebenen <code>url</code>s deinen
        Affiliate-Code (<code>?aff=…</code>) – ohne den Parameter sind es
        neutrale Links ohne Provision. Rate-Limit: 60 Anfragen/Minute je Key.
      </p>

      <SectionH2 id="creator">3. Creator-API (im API-Paket)</SectionH2>
      <p>
        Für Creator mit aktivem API-Paket (25 €/Monat, 20 €/Monat bei
        jährlicher Zahlung). Damit baust du deinen eigenen Shop: Die API
        liefert <em>alle deine</em> veröffentlichten Kurse – auch die, die
        nicht im LearnSphere-Shop gelistet sind. Verkäufe über deine API-Links
        zählen als eigener Kanal: <strong>75 % Anteil</strong> statt 50 %.
      </p>
      <SectionH3>Authentifizierung</SectionH3>
      <p>
        Erstelle einen API-Key im Creator-Studio unter{" "}
        <strong>Vertrieb</strong>. Der Key (<code>ls_…</code>) wird dir genau
        einmal angezeigt und bei uns nur als Hash gespeichert. Sende ihn als
        Bearer-Token:
      </p>
      <CodeBlock>{CREATOR_EXAMPLE}</CodeBlock>
      <p>Ohne gültigen Key oder aktives Paket kommt ein Fehler:</p>
      <CodeBlock>{ERROR_EXAMPLE}</CodeBlock>
      <Endpoint path="/api/v1/courses" />
      <p>
        Alle deine veröffentlichten Kurse mit Preisen, Bewertungen,{" "}
        <code>url</code> (Kauflink mit <code>?via=api</code> – so wird der
        Verkauf deinem Kanal zugerechnet) und <code>embedUrl</code> fürs
        Widget.
      </p>
      <Endpoint path="/api/v1/courses/{slug}" />
      <p>
        Kursdetail inklusive komplettem Curriculum (Abschnitte und Lektionen
        mit Dauer und Vorschau-Flag) – nur für deine eigenen Kurse.
      </p>
      <Callout>
        <p>
          <strong>In Arbeit:</strong> Abruf der Kursinhalte für eingeschriebene
          Nutzer:innen und ein vollständiger API-Checkout. Bis dahin läuft der
          Kauf über den mitgelieferten Kauflink – deine Kund:innen landen auf
          der sicheren LearnSphere-Kaufseite und der Verkauf wird dir mit 75 %
          gutgeschrieben.
        </p>
      </Callout>
      <SectionH3>So schützt du deinen Key</SectionH3>
      <ul>
        <li>
          Rufe die Creator-API <strong>nur von deinem Server</strong> auf – nie
          aus dem Browser. Im Frontend-Code wäre dein Key öffentlich.
        </li>
        <li>
          Lege den Key in eine Umgebungsvariable, nicht ins Repository.
        </li>
        <li>
          Widerrufe Keys sofort im Studio, wenn du ein Leck vermutest – der
          alte Key ist dann augenblicklich ungültig.
        </li>
      </ul>

      <SectionH2 id="security">Sicherheit</SectionH2>
      <ul>
        <li>Alle Anfragen laufen über HTTPS; Keys nur als Bearer-Header.</li>
        <li>
          API-Keys werden ausschließlich gehasht gespeichert und nur einmal im
          Klartext angezeigt.
        </li>
        <li>
          Jede Anfrage prüft Key <em>und</em> Abo-Status – ein gekündigtes
          Paket schließt die API automatisch.
        </li>
        <li>
          Öffentliche Endpunkte enthalten keinerlei personenbezogene Daten und
          sind rate-limitiert.
        </li>
        <li>
          Zahlungen laufen nie über deine Server: Der Kauflink führt auf die
          LearnSphere-Kaufabwicklung (Stripe) – Kartendaten berühren deine
          Infrastruktur nicht.
        </li>
      </ul>

      <SectionH2 id="agents">Integration mit KI-Agents</SectionH2>
      <p>
        Du baust deine Integration mit Claude Code oder einem anderen
        Coding-Agent? Wir stellen eine fertige <code>SKILL.md</code> bereit:
        Sie beschreibt Endpunkte, Auth, Fehlercodes und die Sicherheitsregeln
        (z.&nbsp;B. „API-Key nie im Browser“) in einem Format, das dein Agent
        direkt versteht – so entsteht die Anbindung korrekt statt geraten.
      </p>
      <p>
        Lege die Datei in deinem Projekt unter{" "}
        <code>.claude/skills/learnsphere-api/SKILL.md</code> ab und sag deinem
        Agent z.&nbsp;B. „binde meine LearnSphere-Kurse ein“. Für
        LLM-Crawler gibt es außerdem eine <code>/llms.txt</code>.
      </p>
      <DownloadLink href="/skills/learnsphere-api/SKILL.md" download>
        ⬇ SKILL.md herunterladen
      </DownloadLink>
    </Shell>
  );
}

function EnglishDocs() {
  return (
    <Shell
      kicker="For developers"
      title="LearnSphere API"
      lead="Three access levels, one principle: clean JSON over HTTPS. The public catalog API is free; the creator API is part of the API plan."
      tiers={[
        {
          id: "public",
          title: "Public catalog API",
          badge: "Free",
          badgeTone: "success",
          text: "Every course listed in the LearnSphere shop. No API key required.",
        },
        {
          id: "affiliate",
          title: "Affiliate API",
          badge: "For partners",
          badgeTone: "success",
          text: "The full catalog with your commission links – 15% on referred sales.",
        },
        {
          id: "creator",
          title: "Creator API",
          badge: "API plan",
          badgeTone: "violet",
          text: "Your own courses for your own shop – with an API key, from €20/month.",
        },
      ]}
    >
      <SectionH2 id="basics">Basics</SectionH2>
      <p>
        All endpoints return JSON (UTF-8) over HTTPS only. Successful responses
        are wrapped in <code>{`{ "data": … }`}</code>, errors in{" "}
        <code>{`{ "error": "code" }`}</code> with a matching HTTP status.
        Prices are always cent amounts (<code>priceCents</code>) to avoid
        rounding issues.
      </p>
      <SectionH3>Versioning</SectionH3>
      <p>
        Every API carries its version in the path (<code>/api/public/v1/…</code>,{" "}
        <code>/api/v1/…</code>). Within a version, existing fields and their
        behaviour stay stable – at most, new optional fields are added.
        Breaking changes only ever ship under a new version (<code>v2</code>)
        while the old one keeps running with advance notice. Build your
        integration to ignore unknown additional fields.
      </p>
      <ParamTable>
        <thead>
          <tr>
            <th>Status</th>
            <th>Code</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>401</td>
            <td>
              <code>unauthorized</code>
            </td>
            <td>API key missing, invalid, or revoked.</td>
          </tr>
          <tr>
            <td>403</td>
            <td>
              <code>api_plan_required</code>
            </td>
            <td>The key belongs to an account without an active API plan.</td>
          </tr>
          <tr>
            <td>404</td>
            <td>
              <code>not_found</code>
            </td>
            <td>Course does not exist or is no longer public.</td>
          </tr>
          <tr>
            <td>429</td>
            <td>
              <code>rate_limited</code>
            </td>
            <td>Too many requests – wait briefly and retry.</td>
          </tr>
        </tbody>
      </ParamTable>

      <SectionH2 id="public">1. Public catalog API (free)</SectionH2>
      <p>
        No sign-up, no key. It returns only courses that are published{" "}
        <em>and</em> listed in the LearnSphere shop – exactly what the courses
        page shows. Courses a creator sells exclusively through their own
        channels do not appear here.
      </p>
      <Endpoint path="/api/public/v1/courses" />
      <ParamTable>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>q</td>
            <td>Search term, matches title and subtitle.</td>
          </tr>
          <tr>
            <td>page</td>
            <td>Page, starting at 1 (default 1).</td>
          </tr>
          <tr>
            <td>per</td>
            <td>Results per page, 1–48 (default 12).</td>
          </tr>
        </tbody>
      </ParamTable>
      <CodeBlock>{LIST_EXAMPLE}</CodeBlock>
      <CodeBlock>{LIST_RESPONSE}</CodeBlock>
      <Endpoint path="/api/public/v1/courses/{slug}" />
      <p>
        Course detail including description and curriculum metadata (sections,
        lesson titles, duration, preview flag). Course content itself –
        videos, files, texts – is deliberately not included.
      </p>
      <p>
        Rate limit: <strong>60 requests per minute per IP</strong>. Responses
        may be cached for up to 60 seconds.
      </p>

      <SectionH2 id="affiliate">2. Affiliate API</SectionH2>
      <p>
        For members of the <Link href="/affiliate">affiliate program</Link>:
        the
        full shop catalog with your personal commission links. Purchases via
        these links earn you a <strong>15% commission</strong> – valid for any
        course purchase within 7 days of the click.
      </p>
      <Endpoint path="/api/v1/affiliate/courses?affiliate=true" />
      <p>
        Auth: Bearer API key (same as the creator API; an API plan is{" "}
        <em>not</em> required, only program membership). The{" "}
        <code>affiliate=true</code> parameter is mandatory for the commission:
        only then do the returned <code>url</code>s carry your affiliate code
        (<code>?aff=…</code>) – without it they are neutral links with no
        commission. Rate limit: 60 requests/minute per key.
      </p>

      <SectionH2 id="creator">3. Creator API (API plan)</SectionH2>
      <p>
        For creators with an active API plan (€25/month, €20/month billed
        yearly). Build your own shop: the API returns <em>all of your</em>{" "}
        published courses – including those not listed in the LearnSphere
        shop. Sales through your API links count as your own channel:{" "}
        <strong>75% share</strong> instead of 50%.
      </p>
      <SectionH3>Authentication</SectionH3>
      <p>
        Create an API key in the creator studio under{" "}
        <strong>Distribution</strong>. The key (<code>ls_…</code>) is shown
        exactly once and stored only as a hash. Send it as a Bearer token:
      </p>
      <CodeBlock>{CREATOR_EXAMPLE}</CodeBlock>
      <p>Without a valid key or active plan you get an error:</p>
      <CodeBlock>{ERROR_EXAMPLE}</CodeBlock>
      <Endpoint path="/api/v1/courses" />
      <p>
        All of your published courses with prices, ratings, <code>url</code>{" "}
        (purchase link with <code>?via=api</code> so the sale is attributed to
        your channel) and <code>embedUrl</code> for the widget.
      </p>
      <Endpoint path="/api/v1/courses/{slug}" />
      <p>
        Course detail including the full curriculum (sections and lessons with
        duration and preview flag) – for your own courses only.
      </p>
      <Callout>
        <p>
          <strong>In progress:</strong> fetching course content for enrolled
          users and a full API checkout. Until then, purchases run through the
          provided link – your customers land on the secure LearnSphere
          checkout and the sale is credited to you at 75%.
        </p>
      </Callout>
      <SectionH3>Protecting your key</SectionH3>
      <ul>
        <li>
          Call the creator API <strong>from your server only</strong> – never
          from the browser, where your key would be public.
        </li>
        <li>Keep the key in an environment variable, not in your repo.</li>
        <li>
          Revoke keys immediately in the studio if you suspect a leak – the
          old key becomes invalid instantly.
        </li>
      </ul>

      <SectionH2 id="security">Security</SectionH2>
      <ul>
        <li>All requests use HTTPS; keys travel only as Bearer headers.</li>
        <li>
          API keys are stored hashed only and shown in plain text exactly
          once.
        </li>
        <li>
          Every request verifies both key <em>and</em> subscription status – a
          cancelled plan closes the API automatically.
        </li>
        <li>
          Public endpoints contain no personal data and are rate-limited.
        </li>
        <li>
          Payments never touch your servers: the purchase link leads to the
          LearnSphere checkout (Stripe) – card data stays away from your
          infrastructure.
        </li>
      </ul>

      <SectionH2 id="agents">Integrating with AI agents</SectionH2>
      <p>
        Building your integration with Claude Code or another coding agent?
        We provide a ready-made <code>SKILL.md</code>: it describes endpoints,
        auth, error codes and the security rules (e.g. &ldquo;never use the
        API key in the browser&rdquo;) in a format your agent understands
        directly – so the integration is built correctly instead of guessed.
      </p>
      <p>
        Put the file in your project at{" "}
        <code>.claude/skills/learnsphere-api/SKILL.md</code> and tell your
        agent e.g. &ldquo;embed my LearnSphere courses&rdquo;. For LLM
        crawlers there is also a <code>/llms.txt</code>.
      </p>
      <DownloadLink href="/skills/learnsphere-api/SKILL.md" download>
        ⬇ Download SKILL.md
      </DownloadLink>
    </Shell>
  );
}
