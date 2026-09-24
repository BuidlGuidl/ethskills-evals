import express from "express";
import { isAddress } from "viem";
import { loadConfig } from "./config.js";
import { currentUtcMonth } from "./dates.js";
import { StreakIndexer } from "./indexer.js";
import { StreakStore } from "./store.js";

const config = loadConfig();
const store = await StreakStore.open(
  config.STREAK_DB_PATH,
  config.STREAK_CONTRACT_ADDRESS,
  config.STREAK_START_BLOCK,
);
const indexer = StreakIndexer.create(config, store);
await indexer.start();

const app = express();
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    ...indexer.getStatus(),
  });
});

app.get("/feed", (request, response) => {
  try {
    const limit = clampNumber(request.query.limit, 25, 1, 100);
    const cursor = stringQuery(request.query.cursor);
    response.json(store.getFeed(limit, cursor));
  } catch (error) {
    response.status(400).json({ error: messageFrom(error) });
  }
});

app.get("/feed/stream", (request, response) => {
  const limit = clampNumber(request.query.limit, 25, 1, 100);

  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  response.write(`event: snapshot\ndata: ${JSON.stringify(store.getFeed(limit))}\n\n`);

  const unsubscribe = store.onCheckIn((record) => {
    response.write(`event: check_in\ndata: ${JSON.stringify(record)}\n\n`);
  });

  request.on("close", unsubscribe);
});

app.get("/members/:member", (request, response) => {
  try {
    if (!isAddress(request.params.member)) {
      response.status(400).json({ error: "member must be an EVM address" });
      return;
    }
    response.json(store.getProfile(request.params.member));
  } catch (error) {
    response.status(400).json({ error: messageFrom(error) });
  }
});

app.get("/leaderboard", (request, response) => {
  try {
    const month = stringQuery(request.query.month) ?? currentUtcMonth();
    const limit = clampNumber(request.query.limit, 50, 1, 250);
    response.json(store.getLeaderboard(month, limit));
  } catch (error) {
    response.status(400).json({ error: messageFrom(error) });
  }
});

const server = app.listen(config.PORT, () => {
  console.log(`Streak read API listening on http://localhost:${config.PORT}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await indexer.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const numberValue =
    typeof value === "string" && value.length > 0 ? Number(value) : fallback;
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numberValue)));
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "request failed";
}
