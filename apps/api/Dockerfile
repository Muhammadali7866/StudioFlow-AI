FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY packages/agents/package.json ./packages/agents/

RUN npm install

COPY . .
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/config
RUN npm run build --workspace=packages/agents
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app ./

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
