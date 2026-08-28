# Production image for the Streak indexer + read API.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 42069

# `ponder start` runs the backfill, then tails Base and serves the HTTP API on
# the same process. It is a long-running service, not a job.
# --schema is required; keeping it fixed means a redeploy reuses indexed data
# instead of re-syncing the whole history.
CMD ["sh", "-c", "npx ponder start --schema ${DATABASE_SCHEMA:-public}"]
