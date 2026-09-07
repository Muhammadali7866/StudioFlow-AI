# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first to leverage Docker layer cache
COPY package.json package-lock.json* ./
COPY apps/web/package.json           ./apps/web/
COPY packages/shared/package.json    ./packages/shared/
COPY packages/config/package.json    ./packages/config/
COPY packages/agents/package.json    ./packages/agents/

RUN npm ci

COPY . .

# Build shared package first (web depends on it)
RUN npm run build --workspace=packages/shared

# Build Next.js — next.config.js `output: 'standalone'` produces .next/standalone
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace=apps/web

# ─── Stage 2: Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Cloud Run listens on 8080 by default
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Non-root user — security best practice (matches Next.js official Dockerfile)
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Static assets
COPY --from=builder /app/apps/web/public ./apps/web/public

# Standalone output includes a minimal server.js and all required node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static

USER nextjs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1

# Next.js standalone entrypoint
CMD ["node", "apps/web/server.js"]
