import express from "express";
import { getAddress, isAddress, type Address } from "viem";

import { loadConfig } from "./config.js";
import { StreakStore, type Cursor } from "./db.js";
import { StreakIndexer, startIndexerLoop } from "./indexer.js";

const config = loadConfig();
const store = new StreakStore(config.databasePath);
const app = express();

app.use(express.json());
app.use((_request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

if (!config.disableIndexer) {
  const controller = new AbortController();
  const indexer = new StreakIndexer({ config, store });
  void startIndexerLoop(indexer, config.pollMs, controller.signal);

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      controller.abort();
      store.close();
      process.exit(0);
    });
  }
}

app.get("/", (_request, response) => {
  response.json({
    name: "Streak read API",
    endpoints: ["/feed", "/feed/stream", "/members/:address", "/leaderboard/month", "/healthz"],
  });
});

app.get("/healthz", (_request, response) => {
  response.json({
    ok: true,
    lastScannedBlock: store.lastScannedBlock()?.toString() ?? null,
  });
});

app.get("/feed", (request, response) => {
  const limit = Number(request.query.limit ?? 50);
  const before = parseCursor(request.query.before);
  response.json({ items: store.feed(limit, before) });
});

app.get("/feed/stream", (request, response) => {
  let cursor = parseCursor(request.query.after) ?? store.newestCursor();

  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  response.write(`event: snapshot\ndata: ${JSON.stringify({ items: store.feed(50) })}\n\n`);

  const timer = setInterval(() => {
    const items = store.checkInsAfter(cursor, 100);
    for (const item of items) {
      cursor = { blockNumber: item.blockNumber, logIndex: item.logIndex };
      response.write(`event: check_in\ndata: ${JSON.stringify(item)}\n\n`);
    }
  }, Math.max(config.pollMs, 1000));

  request.on("close", () => clearInterval(timer));
});

app.get("/members/:address", (request, response) => {
  if (!isAddress(request.params.address)) {
    response.status(400).json({ error: "Invalid member address" });
    return;
  }

  response.json(store.memberProfile(getAddress(request.params.address) as Address));
});

app.get("/leaderboard/month", (request, response) => {
  try {
    const month = typeof request.query.month === "string" ? request.query.month : undefined;
    const limit = Number(request.query.limit ?? 100);
    response.json({ month, items: store.monthlyLeaderboard(month, limit) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
  }
});

app.listen(config.port, () => {
  console.log(`Streak read API listening on http://localhost:${config.port}`);
});

function parseCursor(value: unknown): Cursor | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const [blockNumber, logIndex] = value.split(":").map(Number);
  if (!Number.isSafeInteger(blockNumber) || !Number.isSafeInteger(logIndex)) {
    throw new Error("Cursor must be formatted as blockNumber:logIndex");
  }

  return { blockNumber, logIndex };
}
