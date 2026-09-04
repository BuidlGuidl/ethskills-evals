# Production image for the Streak indexer.
#
# Runs `ponder start`, which backfills the contract's full CheckedIn history into
# Postgres on first boot and then tails new blocks, serving the HTTP API on 42069.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 42069

# --schema isolates each deploy's tables; --views-schema exposes the live deploy
# under a stable schema, so a redeploy can backfill without taking the API down.
CMD ["sh", "-c", "npx ponder start --schema ${DATABASE_SCHEMA:-$(date +%s)} --views-schema public --hostname 0.0.0.0"]
