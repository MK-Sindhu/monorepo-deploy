FROM oven/bun:1.4.2

WORKDIR /usr/src/app

# Manifests only, so this layer's cache survives source edits.
# Every workspace manifest is needed for bun to match bun.lock.
COPY package.json bun.lock ./
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/
COPY apps/ws/package.json apps/ws/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/

RUN bun install --frozen-lockfile --filter ws

COPY packages/db packages/db
COPY apps/ws apps/ws

ENV NODE_ENV=production
USER bun
WORKDIR /usr/src/app/apps/ws
EXPOSE 8081

CMD ["bun", "run", "index.ts"]
