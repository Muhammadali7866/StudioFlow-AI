# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first to leverage Docker layer cache
COPY package.json package-lock.json* ./
COPY apps/api/package.json       ./apps/api/
COPY packages/shared/package.json  ./packages/shared/
COPY packages/config/package.json  ./packages/config/
COPY packages/agents/package.json  ./packages/agents/

# Install ALL deps (including devDependencies needed to build TypeScript)
RUN npm ci

# Copy source and compile every workspace in dependency order
COPY . .
RUN npm run build --workspace=packages/shared \
 && npm run build --workspace=packages/config \
 && npm run build --workspace=packages/agents \
 && npm run build --workspace=apps/api

# ─── Stage 2: Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Cloud Run listens on 8080 by default
ENV NODE_ENV=production
ENV PORT=8080

# Non-root user — security best practice
RUN addgroup -S studioflow && adduser -S api -G studioflow

# Copy only what's needed to run (no devDependencies, no TypeScript source)
COPY --from=builder /app/package.json          ./package.json
COPY --from=builder /app/package-lock.json     ./package-lock.json
COPY --from=builder /app/packages/shared/dist  ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/config/dist  ./packages/config/dist
COPY --from=builder /app/packages/config/package.json ./packages/config/package.json
COPY --from=builder /app/packages/agents/dist  ./packages/agents/dist
COPY --from=builder /app/packages/agents/package.json ./packages/agents/package.json
COPY --from=builder /app/apps/api/dist         ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Install production dependencies only — significantly smaller image
RUN npm ci --omit=dev

USER api

EXPOSE 8080

# Cloud Run / orchestrators use this to detect readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
