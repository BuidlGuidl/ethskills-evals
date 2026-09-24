import cors from "cors";
import express from "express";
import { getAddress, isAddress } from "viem";
import { loadConfig } from "./config.js";
import { StreakStore } from "./store.js";
import { monthKeyFromTimestamp } from "./time.js";
import type { FeedCursor } from "./types.js";

export function createApp(store: StreakStore): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/feed", (request, response) => {
    const limit = parseLimit(request.query.limit);
    const cursor = parseCursor(request.query.cursor);

    if (cursor instanceof Error) {
      response.status(400).json({ error: cursor.message });
      return;
    }

    response.json({
      items: store.getFeed(limit, cursor),
    });
  });

  app.get("/members/:address", (request, response) => {
    const { address } = request.params;
    if (!address || !isAddress(address)) {
      response.status(400).json({ error: "Invalid member address" });
      return;
    }

    response.json(store.getMemberProfile(getAddress(address) as `0x${string}`));
  });

  app.get("/leaderboard", (request, response) => {
    const month =
      typeof request.query.month === "string"
        ? request.query.month
        : monthKeyFromTimestamp(Math.floor(Date.now() / 1000));

    if (!/^\d{4}-\d{2}$/.test(month)) {
      response.status(400).json({ error: "month must be YYYY-MM" });
      return;
    }

    response.json({
      month,
      items: store.getMonthlyLeaderboard(month, parseLimit(request.query.limit)),
    });
  });

  app.get("/sync/status", (_request, response) => {
    response.json({
      lastIndexedBlock: store.getLastIndexedBlock()?.toString() ?? null,
    });
  });

  return app;
}

function parseLimit(value: unknown): number {
  if (typeof value !== "string") {
    return 25;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 25;
}

function parseCursor(value: unknown): FeedCursor | undefined | Error {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return new Error("cursor must be a string");
  }

  const [block, log] = value.split(":");
  const blockNumber = Number.parseInt(block ?? "", 10);
  const logIndex = Number.parseInt(log ?? "", 10);

  if (!Number.isInteger(blockNumber) || !Number.isInteger(logIndex)) {
    return new Error("cursor must be formatted as blockNumber:logIndex");
  }

  return { blockNumber, logIndex };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const store = new StreakStore(config.DATABASE_PATH);
  const app = createApp(store);

  const server = app.listen(config.PORT, () => {
    console.log(`Streak API listening on http://localhost:${config.PORT}`);
  });

  process.on("SIGINT", () => {
    server.close();
    store.close();
  });
}
