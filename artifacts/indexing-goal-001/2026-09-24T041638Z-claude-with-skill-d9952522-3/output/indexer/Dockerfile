# Production image for the indexer. `ponder start` runs the historical backfill,
# then tails the chain head and serves the HTTP API on PORT (default 42069).
FROM node:22-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod=false --frozen-lockfile || pnpm install

COPY . .

ENV NODE_ENV=production
EXPOSE 42069

# --schema gives each deploy its own Postgres schema so a new version can
# backfill while the old one keeps serving; Ponder hands over when it is ready.
CMD pnpm ponder start --schema "${RAILWAY_DEPLOYMENT_ID:-public}"
