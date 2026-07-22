#!/usr/bin/env bash
#
# Wird von GitHub Actions per SSH auf dem Server ausgeführt (siehe
# .github/workflows/ci.yml, Job "deploy"). Läuft absichtlich über stdin,
# damit immer die Fassung aus dem gerade gebauten Commit greift.
#
# Manuell auf dem Server auslösen:
#   cd /opt/learnsphere && bash scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/learnsphere}"
BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"

# Dieses Skript AKTUALISIERT eine bestehende Installation – es legt keine
# an. Der Pfad steht im Secret DEPLOY_PATH und wird im Actions-Log als ***
# maskiert; eine nackte "cd"-Fehlermeldung wäre daher nicht lesbar.
if [ ! -d "$APP_DIR" ]; then
  echo "✗ Das Zielverzeichnis auf dem Server existiert nicht." >&2
  echo "  Erwartet wurde der Pfad aus dem Secret DEPLOY_PATH." >&2
  echo "" >&2
  echo "  Das automatische Deployment aktualisiert nur eine bereits" >&2
  echo "  eingerichtete Installation. Das erste Aufsetzen läuft einmalig" >&2
  echo "  von Hand auf dem Server (Repo klonen, .env-Dateien anlegen," >&2
  echo "  'docker compose up -d --build') – siehe" >&2
  echo "  docs/DEPLOY-ANLEITUNG-SCHRITT-FUER-SCHRITT.md, Schritte 5 bis 9." >&2
  exit 1
fi

cd "$APP_DIR"

if [ ! -d .git ]; then
  echo "✗ Im Zielverzeichnis liegt kein Git-Repository." >&2
  echo "  Zeigt DEPLOY_PATH wirklich auf den Ordner mit dem geklonten Projekt?" >&2
  exit 1
fi

# Die Konfiguration liegt NUR auf dem Server (beide Dateien sind gitignored
# und kommen deshalb nie über GitHub). Fehlen sie, würde der Container mit
# unbrauchbarer Konfiguration starten – lieber vorher klar abbrechen.
for f in apps/web/.env.production .env; do
  if [ ! -f "$f" ]; then
    echo "✗ Die Datei $f fehlt im Projektverzeichnis auf dem Server." >&2
    echo "  Sie wird bewusst nicht über Git verteilt (enthält Secrets)." >&2
    echo "  Einmalig anlegen – siehe docs/DEPLOY-ANLEITUNG-SCHRITT-FUER-SCHRITT.md" >&2
    exit 1
  fi
done

echo "▸ Stand vor dem Deploy: $(git rev-parse --short HEAD)"

# Exakt auf den Remote-Stand ziehen. Lokale Änderungen am eingecheckten Code
# werden dabei verworfen – der Server soll main 1:1 spiegeln.
# Die .env-Dateien sind gitignored und bleiben unangetastet.
git fetch --prune origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "▸ Neuer Stand: $(git rev-parse --short HEAD) – $(git log -1 --pretty=%s)"

# Baut das Image neu und tauscht den Container. Die alte Version läuft
# währenddessen weiter; Datenbank und Uploads liegen auf Volumes.
# Schema-Migrationen laufen beim Containerstart (docker-entrypoint.sh).
# Erst bauen, während die alte Fassung weiterläuft – so entsteht keine
# Ausfallzeit durch den Build selbst.
echo "▸ Image bauen …"
docker compose build web

# Dann den Web-Container gezielt austauschen. Bewusst NICHT über
# "docker compose up -d --build": Docker benennt den alten Container dabei
# um ("<hash>_learnsphere-web-1") und scheitert reproduzierbar daran, dass
# der Name noch belegt ist. "rm -sf" entfernt ihn ausdrücklich vorher.
# Die Datenbank bleibt dabei unberührt und muss nicht neu hochfahren.
echo "▸ Web-Container austauschen …"
docker compose rm -sf web >/dev/null 2>&1 || true
docker compose up -d

# Warten, bis die App wirklich antwortet – sonst meldet der Workflow
# fälschlich Erfolg, obwohl der neue Container beim Start abstürzt.
echo "▸ Warte auf Health-Check ($HEALTH_URL) …"
for i in $(seq 1 "$HEALTH_RETRIES"); do
  if curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL"; then
    echo "✓ App antwortet (nach ${i}0s)"
    docker image prune -f >/dev/null 2>&1 || true
    echo "✓ Deploy abgeschlossen: $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 10
done

echo "✗ App antwortet nach $((HEALTH_RETRIES * 10))s nicht – letzte Logzeilen:" >&2
docker compose logs web --tail 50 >&2
exit 1
