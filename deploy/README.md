# Business-Whitelabel: Betrieb auf Hostinger VPS

Ziel: Business-Verwalter bekommen ein **whitelabeltes Lern-Portal** unter
`<slug>.learnsphere.one` **und** optional unter ihrer **eigenen Domain** –
das Team erfährt nie, dass LearnSphere dahintersteht.

## Topologie

```
Kunde/Team  ──HTTPS──▶  Caddy (VPS :443, TLS-Terminierung)  ──HTTP──▶  Next.js (127.0.0.1:3000)
                              │
                              └── on_demand_tls "ask" ─▶ /api/internal/tls-check
```

Caddy terminiert TLS, Next.js läuft als Node-Prozess dahinter (z. B. via
`pm2`/systemd). Siehe [`Caddyfile`](./Caddyfile).

## Warum das automatisch skaliert

| Fall | DNS | TLS | Aufwand pro neuem Mandant |
|------|-----|-----|---------------------------|
| Subdomain `slug.learnsphere.one` | **einmaliger** Wildcard-Record `*.learnsphere.one` | **ein** Wildcard-Zertifikat (DNS-01) | **nur DB-Eintrag** – kein DNS, kein Cert |
| Eigene Kundendomain | Kunde legt `CNAME`/`A` auf den VPS + `TXT`-Verify-Token an | On-Demand-TLS, abgesichert per ask-Endpoint | DB-Eintrag + Domain-Verify |

Der springende Punkt: Für Subdomains ist **keine** Laufzeit-Automatisierung
gegen eine Hosting-API nötig – ein einziger Wildcard-A-Record genügt. Das
Zertifikat holt Caddy pro Subdomain on-demand (HTTP-01), gated durch den
ask-Endpoint. Kein Cloudflare / kein DNS-API-Token erforderlich.

## Einmalige Einrichtung (Hostinger)

1. **DNS für `learnsphere.one`** im Hostinger hPanel
   (Domains → DNS/Nameserver → DNS-Einträge verwalten):
   - `A   @   → <VPS-IP>`   (Hauptdomain)
   - `A   *   → <VPS-IP>`   (**Wildcard** – deckt jede `<slug>.learnsphere.one`)
   > Hostinger-DNS unterstützt den `*`-Wildcard-A-Record. Mehr braucht es für
   > Subdomains nicht. (Falls die Domain noch Hostinger-Parking-Nameserver
   > nutzt: sicherstellen, dass die DNS-Zone von Hostinger verwaltet wird.)
2. **Ports** 80 **und** 443 am VPS offen (HTTP-01-Challenge nutzt Port 80).
3. **Caddy** installieren (Standard-Build reicht, kein DNS-Plugin nötig),
   `Caddyfile` deployen.
4. **App-Env** setzen:
   - `NEXT_PUBLIC_APP_URL=https://learnsphere.one`
   - `TENANT_BASE_DOMAIN=learnsphere.one`
   - `INTERNAL_TLS_CHECK_TOKEN=<secret>`  (Caddy sendet ihn als `x-tls-check-token`)
5. Next.js starten (Node, z. B. via `pm2`/systemd), Caddy neu laden.

## Lokal testen (ohne echtes DNS)

Subdomains kann man lokal über `lvh.me` (löst `*.lvh.me` auf `127.0.0.1` auf)
oder `sslip.io` testen – kein `hosts`-Eintrag nötig. In `.env.local`:

```
NEXT_PUBLIC_APP_URL=http://lvh.me:3000
TENANT_BASE_DOMAIN=lvh.me
```

Dann `npm run dev`, im Business-Dashboard ein Portal mit Slug `xxx` anlegen und
`http://xxx.lvh.me:3000` öffnen → das Whitelabel-Portal erscheint. (Der
`x-tls-check`/Caddy-Teil entfällt lokal, da ohne HTTPS entwickelt wird.)

## Kundendomain-Onboarding (später, App-seitig)

1. Kunde trägt im Business-Dashboard seine Domain ein → App erzeugt
   `domainVerifyToken`.
2. Kunde legt an: `CNAME academy.kunde.de → learnsphere.one` **und**
   `TXT _learnsphere-verify.kunde.de → <token>`.
3. App verifiziert den TXT-Record, setzt `domainVerifiedAt`.
4. Erster HTTPS-Aufruf: Caddy fragt `ask` → Endpoint kennt die (jetzt
   verifizierte) Domain → Zertifikat wird ausgestellt. Fertig.

## Sicherheit (Kurzfassung)

- **Ask-Endpoint** verhindert Zertifikats-Abuse (nur bekannte, aktive Hosts).
- **Ownership-Verify** (TXT) verhindert Domain-Hijacking.
- **Mandanten-Isolation**: Queries hängen am serverseitig verifizierten Host.
- **Session-Cookie** ist host-only (kein `Domain=`) → keine Session leakt
  zwischen Mandanten oder zur Hauptapp.
- **Deprovisioning**: Domain entfernt → Cert & Routing abbauen.
