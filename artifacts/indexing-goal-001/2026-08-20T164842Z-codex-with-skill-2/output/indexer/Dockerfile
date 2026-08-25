FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
CMD ["pnpm", "start"]
