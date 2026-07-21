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

cd "$APP_DIR"

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
echo "▸ Container bauen und starten …"
docker compose up -d --build

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
