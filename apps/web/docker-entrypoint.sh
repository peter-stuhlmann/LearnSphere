#!/bin/sh
set -e

# Schema-Migrationen VOR dem Serverstart anwenden (idempotent) –
# damit kann die Prod-DB nie hinter dem Code-Stand zurückbleiben
echo "[entrypoint] prisma migrate deploy …"
node ./prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma

echo "[entrypoint] starte Next.js (standalone) …"
exec node apps/web/server.js
