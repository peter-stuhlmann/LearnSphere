# Deployment auf Hostinger (Docker, ohne Cloud-Dienste)

> **Erstes Deployment?** Die ausführliche Klick-für-Klick-Anleitung steht in
> [DEPLOY-ANLEITUNG-SCHRITT-FUER-SCHRITT.md](DEPLOY-ANLEITUNG-SCHRITT-FUER-SCHRITT.md).
> Diese Seite hier ist die Kurzreferenz für später.

Die Web-App läuft komplett selbst gehostet: **Next.js (standalone) + MySQL in
Docker**, Uploads auf persistenten Volumes. Kein Objekt-Store nötig – das
Dateisystem des VPS ist dauerhaft.

## Voraussetzungen

- Hostinger **VPS** (KVM) mit Docker + Docker Compose (Hostinger bietet ein
  fertiges „Docker"-OS-Template an)
- Domain (learnsphere.one) mit A-Record auf die VPS-IP

## Erst-Setup

```bash
git clone <repo> && cd e-learning

# 1) Prod-ENV anlegen (niemals einchecken)
cp apps/web/.env.example apps/web/.env.production
#    → AUTH_SECRET (openssl rand -base64 32), NEXT_PUBLIC_APP_URL=https://learnsphere.one,
#      RESEND_API_KEY, STRIPE_*, OPENAI_API_KEY … setzen.
#    DATABASE_URL kann drin bleiben – docker-compose überschreibt sie mit dem Compose-DB-Host.

# 2) DB-Passwörter für Compose setzen (Root-.env neben docker-compose.yml)
cat > .env <<'EOF'
MYSQL_PASSWORD=<sicheres-passwort>
MYSQL_ROOT_PASSWORD=<anderes-sicheres-passwort>
EOF

# 3) Bauen und starten
docker compose up -d --build
```

Der Container führt beim Start automatisch **`prisma migrate deploy`** aus –
die Datenbank ist damit immer auf dem Migrationsstand des Codes.

## HTTPS (Reverse-Proxy)

Am einfachsten Caddy auf dem Host (automatisches Let's-Encrypt):

```bash
apt install caddy
cat > /etc/caddy/Caddyfile <<'EOF'
learnsphere.one {
    reverse_proxy 127.0.0.1:3000
    request_body {
        max_size 1500MB   # Video-Uploads
    }
}
EOF
systemctl reload caddy
```

## Update-Deploy

```bash
git pull
docker compose up -d --build   # baut neu, migriert, startet – Uploads/DB bleiben (Volumes)
```

## Backups

- **DB:** `docker compose exec db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" elearning > backup.sql`
- **Uploads:** Volumes `uploads` + `uploads_protected` sichern
  (`docker run --rm -v e-learning_uploads:/from -v $(pwd):/to alpine tar czf /to/uploads.tgz -C /from .`)
- Beides per Cron auf externen Speicher schieben.

## Hinweise

- Rate-Limiting läuft ohne Upstash im In-Memory-Modus – auf einer einzelnen
  VPS-Instanz ist das völlig ausreichend (ein Prozess = ein Zähler).
- `RESEND_OVERRIDE_TO` in Produktion **leer lassen**, sonst gehen alle Mails
  an eine einzige Adresse.
- Superadmin einmalig anlegen (das Skript liegt im Image):
  `docker compose exec web node scripts/create-superadmin.mjs "mail@domain" "passwort"`
- Der Web-Container ist bewusst nur an `127.0.0.1:3000` gebunden – von außen
  erreichbar ist die App ausschließlich über den HTTPS-Reverse-Proxy.
