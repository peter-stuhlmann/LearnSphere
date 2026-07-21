# Automatisches Deployment bei Push auf main

Nach der Einrichtung gilt: **Du pushst auf `main` → GitHub prüft Typen, Lint
und Tests → bei Grün rollt es automatisch auf den Server aus.** Schlägt eine
Prüfung fehl, passiert auf dem Server nichts.

Voraussetzung: Das [erste Deployment](DEPLOY-ANLEITUNG-SCHRITT-FUER-SCHRITT.md)
ist erledigt, das Projekt liegt also bereits unter `/opt/learnsphere` und
läuft. Die Automatik ersetzt nur die Handarbeit danach.

---

## Ablauf im Detail

1. Push auf `main`
2. Job **check**: `tsc`, ESLint, Tests mit 100-%-Coverage-Schwelle
3. Job **deploy** (nur wenn check grün und nur von `main`):
   - verbindet sich per SSH mit dem Server
   - `git reset --hard origin/main` – der Server spiegelt exakt `main`
   - `docker compose up -d --build` – baut und tauscht den Container
   - Schema-Migrationen laufen automatisch beim Containerstart
   - **Health-Check**: wartet bis zu 5 Minuten, bis die App antwortet;
     kommt keine Antwort, wird der Workflow rot und zeigt die Container-Logs

Während des Builds läuft die alte Version weiter. Die eigentliche
Ausfallzeit ist der Container-Wechsel, also wenige Sekunden.

---

## Einrichtung (einmalig, ca. 10 Minuten)

### 1. SSH-Schlüssel für GitHub erzeugen

**Auf dem Server:**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-actions"
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Dann den **privaten** Schlüssel ausgeben und vollständig kopieren –
inklusive der `BEGIN`- und `END`-Zeilen:

```bash
cat ~/.ssh/github_deploy
```

> Dieser Schlüssel gibt vollen Zugriff auf den Server. Er gehört
> ausschließlich in die GitHub-Secrets, nirgendwo sonst hin.

### 2. Host-Fingerprint holen

**Auf deinem eigenen Rechner** (nicht auf dem Server):

```bash
ssh-keyscan -H 187.124.12.134
```

Die Ausgabe (mehrere Zeilen) kopieren. Damit weiß GitHub beim Verbinden,
dass es wirklich mit deinem Server spricht.

### 3. Secrets in GitHub hinterlegen

Repository → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Diese fünf anlegen:

| Name | Wert |
|------|------|
| `DEPLOY_HOST` | `187.124.12.134` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_PATH` | `/opt/learnsphere` |
| `DEPLOY_SSH_KEY` | kompletter privater Schlüssel aus Schritt 1 |
| `DEPLOY_KNOWN_HOSTS` | Ausgabe aus Schritt 2 |

`DEPLOY_KNOWN_HOSTS` ist technisch optional – fehlt es, übernimmt der
Workflow den Host-Key beim ersten Kontakt ungeprüft. Setzen ist besser.

### 4. Ausprobieren

Am saubersten mit einer belanglosen Änderung:

```bash
git commit --allow-empty -m "CI/CD testen"
git push
```

Dann im Repository auf **Actions** den Lauf öffnen. Du siehst beide Jobs;
im Deploy-Job stehen der alte und neue Commit-Hash und am Ende
`✓ Deploy abgeschlossen`.

Manuell auslösen geht auch: **Actions** → *CI/CD* → **Run workflow**.

---

## Was du dabei wissen solltest

**Der Server spiegelt `main` hart.** `git reset --hard` verwirft Änderungen,
die du direkt auf dem Server am eingecheckten Code gemacht hast. Deine
`.env.production` und `.env` sind davon **nicht** betroffen (sie sind
gitignored), ebenso wenig Datenbank und Uploads (Volumes).

**Migrationen laufen automatisch mit.** Prisma-Migrationen sind additiv;
trotzdem gilt: Vor Änderungen an bestehenden Spalten ein Backup ziehen.

**Ein kaputter Commit macht die Seite nicht sofort kaputt.** Scheitert der
Build, bleibt der alte Container stehen. Startet der neue Container zwar,
antwortet aber nicht, wird der Workflow rot – die Seite ist dann allerdings
down. Zurückrollen:

```bash
cd /opt/learnsphere
git reset --hard <letzter-guter-commit>
docker compose up -d --build
```

**Zugriff als root.** Der Deploy-Schlüssel hat vollen Serverzugriff. Für
einen Server, auf dem nur dieses Projekt läuft, ist das vertretbar. Willst
du es enger fassen, lege einen eigenen Benutzer an und nimm ihn in die
Gruppe `docker` auf – beachte aber, dass Docker-Rechte praktisch
Root-Rechte sind. Den echten Sicherheitsgewinn bringt eher, den
Schlüssel auf den Deploy-Befehl zu beschränken (`command=` in
`authorized_keys`).

**Kosten.** Bei einem privaten Repository verbraucht jeder Lauf
GitHub-Actions-Minuten (Free-Tarif: 2.000/Monat). Ein Durchlauf liegt
grob bei 3–6 Minuten, das reicht für gut 300 Deploys im Monat.

---

## Wenn es hakt

**`Permission denied (publickey)`** – der Schlüssel wurde nicht vollständig
ins Secret kopiert (die `BEGIN`/`END`-Zeilen gehören dazu) oder liegt nicht
in `~/.ssh/authorized_keys` des richtigen Benutzers.

**`Host key verification failed`** – `DEPLOY_KNOWN_HOSTS` passt nicht zum
Server, etwa nach einer Neuinstallation. Neu erzeugen (Schritt 2).

**Deploy läuft, aber die Seite ist alt** – Browser-Cache leeren; sonst auf
dem Server `docker compose ps` und `git log -1` prüfen.

**Health-Check schlägt fehl** – der Workflow hängt die letzten 50 Logzeilen
an. Meist fehlt eine Variable in `.env.production`.
