# Production image for the Streak indexer.
#
# One long-running process: it backfills the contract's full history into
# Postgres on first boot, then tails new Base blocks forever. It is a server,
# not a job — do not run it on a cron, and do not scale it past one replica per
# database schema.
FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 42069

# /ready is false until the historical backfill finishes, so a platform health
# check pointed here will not send traffic to a half-indexed API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
  CMD curl -fsS http://localhost:42069/health || exit 1

# DATABASE_SCHEMA is set per deploy so a new version can index into a fresh
# schema while the old one keeps serving. See README "Deploying".
CMD npx ponder start --schema "${DATABASE_SCHEMA:-public}"
