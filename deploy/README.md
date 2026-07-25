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
gegen eine Hosting-API nötig. Wildcard-DNS + Wildcard-Cert decken jede neue
Subdomain sofort ab.

## Einmalige Einrichtung

1. **DNS für `learnsphere.one`** (bei Hostinger oder Cloudflare):
   - `A  @            → <VPS-IP>`
   - `A  *            → <VPS-IP>`   (Wildcard, deckt alle Subdomains)
   - Für DNS-01-Wildcard-TLS braucht Caddy API-Zugriff auf die DNS-Zone
     (Cloudflare-Token o. ä. – das entsprechende Caddy-DNS-Plugin einbauen).
2. **Caddy** installieren (mit DNS-Plugin), `Caddyfile` deployen.
3. **App-Env** setzen:
   - `NEXT_PUBLIC_APP_URL=https://learnsphere.one`
   - `TENANT_BASE_DOMAIN=learnsphere.one`
   - `INTERNAL_TLS_CHECK_TOKEN=<secret>`  (Caddy sendet ihn als `x-tls-check-token`)
4. Next.js starten (Node), Caddy neu laden.

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
