# Container image for the Streak indexer, for hosts that take a Dockerfile
# instead of Nixpacks (Fly.io, Render, ECS, a plain VM).
FROM node:22-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV PORT=42069
EXPOSE 42069

# --schema must be unique per deployment so a new version backfills into its own
# namespace and only starts serving once it has caught up. Set it from the
# host's deployment/revision id.
CMD ["sh", "-c", "pnpm start --schema ${DATABASE_SCHEMA:-streak}"]
