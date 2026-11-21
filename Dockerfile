# syntax=docker/dockerfile:1
# Backend only. The Android app remains on the phone.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
RUN pnpm --filter @workspace/api-server... install --frozen-lockfile

COPY artifacts/api-server/ artifacts/api-server/
COPY lib/api-zod/ lib/api-zod/
COPY lib/db/ lib/db/
RUN pnpm --filter @workspace/api-server run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=5000 \
    FINANCE_DATA_DIR=/var/lib/auria/data \
    CODEX_OAUTH_FILE=/var/lib/auria/oauth/oauth-session.json
WORKDIR /app
RUN install -d -m 0700 -o node -g node \
    /var/lib/auria /var/lib/auria/data /var/lib/auria/oauth
COPY --from=build --chown=node:node /app/artifacts/api-server/dist/ ./dist/
COPY --chmod=0555 ops/container-entrypoint.sh /usr/local/bin/auria-entrypoint
USER node
EXPOSE 5000
ENTRYPOINT ["auria-entrypoint"]
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
