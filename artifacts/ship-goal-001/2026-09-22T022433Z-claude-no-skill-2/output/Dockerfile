# Toolshed ships as one image: the API process also serves the built client.
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Dependencies first, so a code-only change reuses the install layer.
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/toolshed.db \
    UPLOAD_DIR=/data/uploads \
    WEB_DIST_DIR=/app/web/dist

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
# better-sqlite3 has a native binding, so production deps are installed here
# rather than copied from the build stage.
RUN npm ci --omit=dev --workspace server --include-workspace-root

COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist

# SQLite file and uploaded photos both live on this volume.
VOLUME /data
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
