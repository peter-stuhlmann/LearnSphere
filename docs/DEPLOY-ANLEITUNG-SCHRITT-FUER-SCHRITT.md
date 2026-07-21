# LearnSphere auf Hostinger deployen – Schritt für Schritt

Diese Anleitung führt vom leeren VPS bis zur laufenden Seite unter
`https://learnsphere.one`. Sie setzt **keine Docker-Erfahrung** voraus.
Die knappe Referenz für später steht in [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md).

**Zeitbedarf:** ca. 1–1,5 Stunden, davon ~20 Minuten Wartezeit.

**Was am Ende läuft:** Zwei Docker-Container auf deinem Server – die Web-App
und die MySQL-Datenbank. Davor ein Reverse-Proxy (Caddy), der HTTPS macht.
Datenbank und Uploads liegen auf persistenten Volumes und überleben jedes
Update.

---

## Schritt 0 – Was du vorher brauchst

- **Hostinger VPS** (KVM). **Kein Shared Hosting** – das kann kein Docker
  und kein Node.js. Mindestens **2 GB RAM**, besser 4 GB (siehe Schritt 8).
- Die Domain **learnsphere.one** in einem Konto, wo du DNS-Einträge
  bearbeiten kannst.
- Ein **GitHub-Konto** (kostenlos) – siehe Schritt 1.
- Ein Terminal auf deinem Rechner. Unter Windows: PowerShell oder Git Bash,
  beides kann `ssh`.

---

## Schritt 1 – Code auf GitHub bringen

**Warum:** Aktuell liegt das gesamte Projekt nur auf deinem Rechner und ist
nicht committet. Der Server muss den Code aber irgendwoher bekommen, und für
spätere Updates willst du `git pull` statt Dateien hin- und herzukopieren.

Auf **deinem Rechner**, im Projektordner:

```bash
cd c:/Users/info/Documents/dev/CLAUDE/e-learning

# Prüfen, dass keine Geheimnisse mitkommen (muss BEIDE Zeilen zeigen):
git check-ignore -v apps/web/.env apps/web/.env.production

git add -A
git commit -m "LearnSphere: kompletter Stand vor dem ersten Deploy"
```

Dann auf [github.com/new](https://github.com/new) ein **privates** Repository
namens `learnsphere` anlegen – **ohne** README, .gitignore oder Lizenz
(sonst gibt es beim ersten Push einen Konflikt). GitHub zeigt danach die
passenden Befehle; sie lauten sinngemäß:

```bash
git remote add origin https://github.com/<dein-name>/learnsphere.git
git branch -M main
git push -u origin main
```

> **Wichtig:** Das Repo muss **privat** sein. Im Code stehen zwar keine
> Passwörter (die `.env`-Dateien sind ausgeschlossen), aber dein
> Geschäftsmodell, die Preislogik und alle Inhalte gehen niemanden etwas an.

**Zugriff vom Server:** Für ein privates Repo braucht der Server eine
Berechtigung. Am einfachsten ist ein **Personal Access Token**:
GitHub → Profilbild → *Settings* → *Developer settings* → *Personal access
tokens* → *Tokens (classic)* → *Generate new token*, Haken bei `repo`,
Gültigkeit z. B. 1 Jahr. Token kopieren und sicher notieren – er wird nur
einmal angezeigt.

---

## Schritt 2 – VPS mit Docker aufsetzen

In hPanel: **VPS** → bei deinem Server auf **Manage** → links
**OS & Panel** → **Operating System** → Abschnitt **Change OS** → im
Suchfeld `Docker` eingeben und das Docker-Template wählen (Ubuntu 24.04 mit
vorinstalliertem Docker und Docker Compose).

Bestätigen und **ca. 10 Minuten warten**. Beim Einrichten legst du ein
Root-Passwort fest – notiere es.

> Achtung: Das setzt den Server komplett neu auf. Wenn dort schon etwas
> läuft, vorher sichern.

Notiere dir am Ende die **IP-Adresse** des VPS (steht im hPanel-Dashboard).

---

## Schritt 3 – Per SSH einloggen

Auf deinem Rechner:

```bash
ssh root@<deine-vps-ip>
```

Beim ersten Mal fragt SSH, ob du dem Server vertraust → `yes`. Dann das
Root-Passwort eingeben (die Eingabe ist unsichtbar, das ist normal).

Prüfen, dass Docker da ist:

```bash
docker --version
docker compose version
```

Beide Befehle müssen eine Versionsnummer ausgeben. Falls nicht, war das
Docker-Template nicht aktiv – zurück zu Schritt 2.

**Ab hier laufen alle Befehle auf dem Server**, außer es steht ausdrücklich
etwas anderes dabei.

---

## Schritt 4 – Domain auf den Server zeigen lassen

Beim Anbieter deiner Domain zwei DNS-Einträge setzen:

| Typ | Name | Wert |
|-----|------|------|
| A   | `@`  | `<deine-vps-ip>` |
| A   | `www` | `<deine-vps-ip>` |

Die Verbreitung dauert je nach Anbieter Minuten bis wenige Stunden. Prüfen:

```bash
ping -c 1 learnsphere.one
```

Es muss deine VPS-IP erscheinen. **Warte damit, bis das stimmt** – Caddy
kann sonst in Schritt 9 kein HTTPS-Zertifikat holen.

---

## Schritt 5 – Code auf den Server holen

```bash
cd /opt
git clone https://github.com/<dein-name>/learnsphere.git
cd learnsphere
```

Bei einem privaten Repo fragt Git nach Zugangsdaten:
- **Username:** dein GitHub-Benutzername
- **Password:** der **Token** aus Schritt 1 (nicht dein GitHub-Passwort)

Damit du den Token nicht bei jedem Update neu eingeben musst:

```bash
git config --global credential.helper store
```

(Beim nächsten `git pull` einmal eingeben, danach merkt Git ihn sich.)

---

## Schritt 6 – Zugangsdaten der App eintragen

Vorlage kopieren:

```bash
cp apps/web/.env.example apps/web/.env.production
```

Zuerst die zwei Sicherheitsschlüssel erzeugen:

```bash
openssl rand -base64 32   # → für AUTH_SECRET
openssl rand -base64 32   # → für MOBILE_JWT_SECRET
```

Beide Ausgaben kopieren. Dann die Datei bearbeiten:

```bash
nano apps/web/.env.production
```

> **nano-Bedienung:** Pfeiltasten zum Navigieren, tippen zum Ändern.
> Speichern mit `Strg+O` dann `Enter`, schließen mit `Strg+X`.

Diese Werte **musst** du setzen:

```ini
AUTH_SECRET="<erste openssl-Ausgabe>"
MOBILE_JWT_SECRET="<zweite openssl-Ausgabe>"
NEXT_PUBLIC_APP_URL="https://learnsphere.one"

# ⚠️ Muss leer bleiben (ist es in der Vorlage bereits) – steht hier eine
# Adresse, gehen ALLE Mails dorthin statt an die echten Empfänger
# (Wartelisten-Mails, Passwort-Reset, Registrierungsbestätigung …).
# Nur zum Testen befüllen, nie im Livebetrieb.
RESEND_OVERRIDE_TO=""
```

Diese Werte solltest du setzen, damit die Features funktionieren:

```ini
RESEND_API_KEY="re_..."        # Mailversand (Registrierung, Warteliste, Reset)
STRIPE_SECRET_KEY="sk_live_..." # Zahlungen
STRIPE_WEBHOOK_SECRET="whsec_..." # kommt in Schritt 11
OPENAI_API_KEY="sk-..."        # Transkripte + Inhaltsprüfung
ANTHROPIC_API_KEY="sk-ant-..." # Übersetzungen + KI-Bewertung
```

`DATABASE_URL` kannst du ignorieren – Docker Compose überschreibt sie
automatisch mit der internen Datenbank.

> **Ohne `RESEND_API_KEY`** verschickt die App keine Mails, sondern schreibt
> sie ins Log. Registrierungen sind dann nicht bestätigbar. Für einen
> ersten Test in Ordnung, für echte Nutzer nicht.

---

## Schritt 7 – Datenbank-Passwörter festlegen

Zwei Passwörter erzeugen:

```bash
openssl rand -base64 24
openssl rand -base64 24
```

Und in eine zweite Datei schreiben (die liegt im Projekt-Hauptordner, nicht
in `apps/web`):

```bash
nano .env
```

Inhalt:

```ini
MYSQL_PASSWORD=<erste Ausgabe>
MYSQL_ROOT_PASSWORD=<zweite Ausgabe>
```

Speichern und schließen. **Diese Passwörter brauchst du für Backups** –
notiere sie dir an einem sicheren Ort.

---

## Schritt 8 – Auslagerungsspeicher anlegen (bei 2 GB RAM)

Der erste Build ist speicherhungrig. Auf einem 2-GB-Server bricht er sonst
mit `Killed` oder `exit code 137` ab. Vier Befehle, die das verhindern:

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Prüfen mit `free -h` – bei „Swap" müssen jetzt 4 GB stehen. Bei 8 GB RAM
oder mehr kannst du diesen Schritt überspringen.

---

## Schritt 9 – Starten

```bash
cd /opt/learnsphere
docker compose up -d --build
```

**Der erste Durchlauf dauert 5–15 Minuten** – Docker lädt die Node- und
MySQL-Images, installiert alle Pakete und baut die App. Du siehst viel
Text vorbeilaufen, das ist normal.

Danach prüfen:

```bash
docker compose ps
```

Beide Container (`web` und `db`) müssen `Up` sein, die Datenbank
zusätzlich `(healthy)`.

Läuft die App wirklich?

```bash
curl -I http://127.0.0.1:3000
```

Erwartete Antwort: `HTTP/1.1 200 OK`. Falls nicht, siehe *Troubleshooting*.

> Die App ist absichtlich nur lokal erreichbar (`127.0.0.1`) – von außen
> kommt man erst über HTTPS im nächsten Schritt hinein.

Die Datenbank-Tabellen wurden beim Start automatisch angelegt; im Log
(`docker compose logs web`) steht dazu `prisma migrate deploy`.

---

## Schritt 10 – HTTPS einrichten (Caddy)

Caddy holt und erneuert Let's-Encrypt-Zertifikate vollautomatisch.

```bash
apt update
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
```

Konfiguration schreiben:

```bash
cat > /etc/caddy/Caddyfile <<'EOF'
learnsphere.one, www.learnsphere.one {
    reverse_proxy 127.0.0.1:3000
    request_body {
        max_size 1500MB
    }
}
EOF

systemctl reload caddy
```

`max_size` ist wichtig – ohne das scheitern große Video-Uploads.

Jetzt im Browser **https://learnsphere.one** aufrufen. Beim ersten Aufruf
kann es 10–30 Sekunden dauern, weil Caddy im Hintergrund das Zertifikat
ausstellt. Wenn das Schloss-Symbol erscheint: **die Seite ist live.**

Falls nicht, prüfe mit `systemctl status caddy` und `journalctl -u caddy -n 50`.
Häufigste Ursache: Der DNS-Eintrag aus Schritt 4 zeigt noch nicht auf den Server.

---

## Schritt 11 – Externe Dienste verbinden

**Stripe-Webhook** (nötig, damit Käufe freigeschaltet werden):
Im Stripe-Dashboard → *Entwickler* → *Webhooks* → *Endpunkt hinzufügen*:
- URL: `https://learnsphere.one/api/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.*`,
  `account.updated`, `charge.refunded`
- **Haken bei „Events von verbundenen Konten"** – sonst fehlen
  Connect-Verkäufe.

Stripe zeigt danach ein *Signing secret* (`whsec_...`). Das auf dem Server
eintragen und neu starten:

```bash
nano apps/web/.env.production     # STRIPE_WEBHOOK_SECRET setzen
docker compose up -d
```

**Resend:** Domain `learnsphere.one` verifizieren (SPF/DKIM-Einträge im DNS
setzen), sonst landen Mails im Spam.

**Google-/LinkedIn-Login:** In der jeweiligen Konsole die Redirect-URI
`https://learnsphere.one/api/auth/callback/google` bzw. `.../linkedin`
eintragen.

---

## Schritt 12 – Superadmin anlegen

Damit du in den Admin-Bereich (`/admin`) kommst – Moderation, Kurs- und
Nutzerverwaltung:

```bash
docker compose exec web node scripts/create-superadmin.mjs \
  "deine@mail.de" "<sicheres-passwort>"
```

Erwartete Ausgabe: `Superadmin bereit: deine@mail.de (Rolle ADMIN)`.

Danach auf der Seite einloggen und prüfen, dass `/de/admin` erreichbar ist.
Dort landen die Moderations-Fälle, die Kurs- und Nutzerverwaltung sowie das
KI-Verbrauchs-Dashboard.

> Das Konto ist sofort als E-Mail-bestätigt angelegt – du musst also keine
> Bestätigungsmail abwarten. Wähle ein starkes Passwort und aktiviere nach
> dem ersten Login die 2FA in den Einstellungen.

---

## Schritt 13 – Abnahme-Checkliste

Klick dich einmal durch, bevor du echte Nutzer einlädst:

- [ ] Startseite lädt mit Schloss-Symbol (HTTPS)
- [ ] Registrierung funktioniert **und die Bestätigungsmail kommt an**
- [ ] Login inkl. Passwort-Reset
- [ ] Kurs anlegen, Video hochladen (Transkript startet automatisch)
- [ ] Kurs kaufen mit einer echten Karte (kleiner Betrag) → Zugang da,
      Verkauf im Creator-Bereich sichtbar
- [ ] Zertifikat herunterladen und über `/verifizieren` prüfen
- [ ] `/wiederholen`, `/mein-lernen` und die Kurs-Statistiken öffnen sich
- [ ] Seite auf dem Handy testen (ab 320 px Breite)

---

## Updates einspielen

**Automatisch:** Richte einmalig das automatische Deployment ein – dann
genügt künftig ein `git push`, siehe [DEPLOY-CI-CD.md](DEPLOY-CI-CD.md).

**Von Hand:**

```bash
cd /opt/learnsphere
git pull
docker compose up -d --build
```

Datenbank und Uploads bleiben erhalten (sie liegen auf Volumes), neue
Schema-Änderungen werden beim Start automatisch migriert. Rechne mit
1–2 Minuten Ausfallzeit während des Neustarts.

---

## Backups einrichten

**Unbedingt vor dem Livegang.** Ohne Backup ist ein Serverausfall das Ende
aller Kursinhalte und Zertifikate.

Skript anlegen:

```bash
mkdir -p /opt/backups
cat > /opt/backup-learnsphere.sh <<'EOF'
#!/bin/bash
set -e
cd /opt/learnsphere
source .env
DATE=$(date +%F)
docker compose exec -T db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" elearning \
  | gzip > /opt/backups/db-$DATE.sql.gz
docker run --rm -v learnsphere_uploads:/from -v /opt/backups:/to alpine \
  tar czf /to/uploads-$DATE.tgz -C /from .
docker run --rm -v learnsphere_uploads_protected:/from -v /opt/backups:/to alpine \
  tar czf /to/uploads-protected-$DATE.tgz -C /from .
find /opt/backups -name '*.gz' -mtime +14 -delete
find /opt/backups -name '*.tgz' -mtime +14 -delete
EOF
chmod +x /opt/backup-learnsphere.sh
```

Einmal von Hand testen (`/opt/backup-learnsphere.sh`, danach `ls -lh /opt/backups`),
dann täglich um 3 Uhr laufen lassen:

```bash
crontab -e
# Diese Zeile ans Ende:
0 3 * * * /opt/backup-learnsphere.sh >> /var/log/learnsphere-backup.log 2>&1
```

> Die Volume-Namen beginnen mit dem Ordnernamen. Bei `/opt/learnsphere`
> heißen sie `learnsphere_uploads` usw. – prüfe mit `docker volume ls`
> und passe das Skript an, falls dein Ordner anders heißt.
>
> **Backups gehören zusätzlich weg vom Server** (Hostinger-Snapshots,
> anderer Speicher). Ein Backup auf derselben Maschine hilft bei einem
> Totalausfall nicht.

---

## Troubleshooting

**Build bricht ab mit `Killed` oder `exit code 137`**
Zu wenig Arbeitsspeicher → Schritt 8 (Swap) nachholen und
`docker compose up -d --build` erneut ausführen.

**`docker compose ps` zeigt `web` als `Restarting`**
```bash
docker compose logs web --tail 80
```
Meist eine fehlende oder fehlerhafte Variable in `.env.production`.

**Seite zeigt 500-Fehler**
Fast immer die Datenbankverbindung:
```bash
docker compose logs db --tail 40
docker compose logs web --tail 80
```

**Caddy bekommt kein Zertifikat**
DNS prüfen (`ping learnsphere.one` muss die VPS-IP zeigen) und dass die
Ports 80 und 443 frei sind: `ss -tlnp | grep -E ':(80|443)'`.

**Upload großer Videos schlägt fehl**
`max_size` im Caddyfile prüfen, danach `systemctl reload caddy`.

**Alles auf Anfang (nur wenn noch keine echten Daten drin sind!)**
```bash
docker compose down -v     # -v löscht ALLE Volumes = Datenbank + Uploads
docker compose up -d --build
```

---

## Nützliche Befehle

```bash
docker compose ps                    # Status
docker compose logs -f web           # Live-Log (Strg+C beendet)
docker compose restart web           # nur neu starten
docker compose down                  # stoppen (Daten bleiben)
docker compose exec db mysql -u root -p elearning   # DB-Konsole
df -h                                # Speicherplatz
free -h                              # RAM/Swap
```
