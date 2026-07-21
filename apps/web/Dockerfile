# LearnSphere Web – Self-Hosting (Hostinger-VPS o. ä.)
# Build-Kontext ist das MONOREPO-ROOT:  docker build -f apps/web/Dockerfile .
# glibc-Basis (bookworm), damit das ffmpeg-static-Binary läuft (kein musl/alpine)

# ---------- Build ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /repo

# Workspace-Manifeste zuerst (Docker-Layer-Cache für npm ci)
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/i18n/package.json packages/i18n/package.json
COPY packages/tokens/package.json packages/tokens/package.json
COPY packages/api-contracts/package.json packages/api-contracts/package.json

# Mobile-Workspace bewusst ausgespart (Expo zieht hunderte MB nach)
RUN npm ci --workspace @elearning/web --include-workspace-root --ignore-scripts

COPY packages ./packages
COPY apps/web ./apps/web

# Prisma-Client generieren und bauen (Dummy-URL: der Build braucht keine DB)
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
RUN npx prisma generate --schema apps/web/prisma/schema.prisma
RUN npm run build -w @elearning/web

# ---------- Runtime ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone-Server inkl. gehoisteter node_modules (outputFileTracingRoot=Repo-Root)
COPY --from=builder /repo/apps/web/.next/standalone ./
# Statische Assets + public gehören neben server.js (apps/web/…)
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

# Wartungsskripte (z. B. Superadmin anlegen) – laufen per docker compose exec
COPY --from=builder /repo/apps/web/scripts ./scripts

# Migrationen + Prisma-CLI für "migrate deploy" beim Start
COPY --from=builder /repo/apps/web/prisma ./prisma
COPY --from=builder /repo/node_modules/prisma ./prisma-cli/node_modules/prisma
COPY --from=builder /repo/node_modules/@prisma ./prisma-cli/node_modules/@prisma
COPY --from=builder /repo/node_modules/.bin/prisma ./prisma-cli/node_modules/.bin/prisma

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
