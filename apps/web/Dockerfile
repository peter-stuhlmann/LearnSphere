# LearnSphere Web – Self-Hosting (Hostinger-VPS o. ä.)
# Build-Kontext ist das MONOREPO-ROOT:  docker build -f apps/web/Dockerfile .
# glibc-Basis (bookworm), damit das ffmpeg-static-Binary läuft (kein musl/alpine)

# ---------- Build ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /repo

# OpenSSL muss schon HIER liegen: "prisma generate" wählt die Query-Engine
# anhand der erkannten libssl-Version. Ohne OpenSSL rät Prisma auf
# openssl-1.1.x, während das Runtime-Image 3.0 nutzt – der Client findet
# dann zur Laufzeit seine Engine nicht.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Workspace-Manifeste zuerst (Docker-Layer-Cache für npm ci)
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/i18n/package.json packages/i18n/package.json
COPY packages/tokens/package.json packages/tokens/package.json
COPY packages/api-contracts/package.json packages/api-contracts/package.json

# Mobile-Workspace bewusst ausgespart (Expo zieht hunderte MB nach)
RUN npm ci --workspace @elearning/web --include-workspace-root --ignore-scripts

# ffmpeg-static lädt sein Binary über ein Install-Skript – das --ignore-scripts
# oben unterbindet den Download. Für die automatische Transkription (Audio
# aus Video ziehen, in Stücke schneiden) braucht es dieses Binary. Deshalb den
# Download hier gezielt für dieses eine Paket nachholen, statt alle Scripts zu
# erlauben. Ohne diesen Schritt scheitert jede Video-Transkription zur Laufzeit
# mit "spawn …/ffmpeg-static/ffmpeg ENOENT".
RUN node node_modules/ffmpeg-static/install.js \
 && test -x node_modules/ffmpeg-static/ffmpeg

COPY packages ./packages
COPY apps/web ./apps/web

# Prisma-Client generieren und bauen (Dummy-URL: der Build braucht keine DB)
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
RUN npx prisma generate --schema apps/web/prisma/schema.prisma
RUN npm run build -w @elearning/web

# Prisma-CLI (für "migrate deploy" beim Containerstart) samt ALLER
# transitiven Abhängigkeiten isoliert installieren. Einzelne Pakete aus
# dem Workspace ins Runtime-Image zu kopieren reicht nicht: @prisma/config
# zieht effect, c12, deepmerge-ts und empathic nach – fehlen sie, stirbt
# der Container beim Start mit "Cannot find module 'effect'".
# Version wird aus dem Workspace übernommen, damit CLI und Client nie
# auseinanderlaufen.
RUN mkdir -p /cli && cd /cli \
 && npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund \
      "prisma@$(node -p "require('/repo/node_modules/prisma/package.json').version")"

# ---------- Runtime ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Prisma braucht OpenSSL, um die passende Query-Engine zu wählen; im
# slim-Image fehlt es und Prisma warnt beim Start ("failed to detect the
# libssl/openssl version") und rät auf openssl-1.1.x.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Standalone-Server inkl. gehoisteter node_modules (outputFileTracingRoot=Repo-Root)
COPY --from=builder /repo/apps/web/.next/standalone ./
# Statische Assets + public gehören neben server.js (apps/web/…)
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

# Prisma-Query-Engine explizit übernehmen. Das File-Tracing von Next.js
# nimmt die .so-Binärdatei nicht zuverlässig mit; fehlt sie, startet der
# Server zwar, aber jede Datenbankabfrage scheitert mit
# "could not locate the Query Engine".
COPY --from=builder /repo/node_modules/.prisma/client ./node_modules/.prisma/client

# Wartungsskripte (z. B. Superadmin anlegen) – laufen per docker compose exec
COPY --from=builder /repo/apps/web/scripts ./scripts

# bcryptjs für die Wartungsskripte. Next.js kompiliert das Paket in seine
# Server-Bundles, sodass es im standalone-Output nicht als eigenes Modul
# liegt – ein eigenständig gestartetes Skript kann es dann nicht laden
# ("Cannot find module 'bcryptjs'"). @prisma/client ist bereits vorhanden.
COPY --from=builder /repo/node_modules/bcryptjs ./node_modules/bcryptjs

# ffmpeg-static-Binary. Das File-Tracing von Next.js nimmt das JS des Pakets
# mit (der Pfad wird zur Laufzeit aufgelöst), nicht aber die ausführbare
# Binärdatei daneben. Sie muss – wie die Prisma-Engine – ausdrücklich
# übernommen werden, sonst schlägt jede Video-Transkription fehl.
COPY --from=builder /repo/node_modules/ffmpeg-static/ffmpeg ./node_modules/ffmpeg-static/ffmpeg

# Migrationen + vollständige Prisma-CLI für "migrate deploy" beim Start
COPY --from=builder /repo/apps/web/prisma ./prisma
COPY --from=builder /cli/node_modules ./prisma-cli/node_modules

COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
  && mkdir -p /data/uploads /data/uploads-protected \
  && chown -R node:node /app /data

USER node

# Uploads liegen auf Volumes – überleben Redeploys und Image-Updates
ENV UPLOADS_DIR=/data/uploads
ENV PROTECTED_UPLOADS_DIR=/data/uploads-protected
VOLUME ["/data/uploads", "/data/uploads-protected"]

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
