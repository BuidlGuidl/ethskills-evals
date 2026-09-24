import express from "express";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createIndexer } from "./indexer.js";
import { ReadModelStore } from "./store.js";
import { monthDayRange } from "./time.js";

const config = loadConfig();
const store = new ReadModelStore(config.dataFile);
const indexer = createIndexer(config, store);
const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    cursorBlock: store.cursorBlock?.toString() ?? null,
    contractAddress: config.contractAddress
  });
});

app.get("/api/feed", (req, res) => {
  const limit = Number(req.query.limit ?? "50");
  res.json({
    items: store.feed(limit)
  });
});

app.get("/api/members/:address", (req, res) => {
  try {
    res.json(store.memberProfile(req.params.address));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/leaderboard/monthly", (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year ?? now.getUTCFullYear());
    const month = Number(req.query.month ?? now.getUTCMonth() + 1);
    const limit = Number(req.query.limit ?? "50");
    const range = monthDayRange(year, month);

    res.json({
      year,
      month,
      items: store.monthlyLeaderboard(range.startDay, range.endDay, limit)
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

const webRoot = join(fileURLToPath(new URL("../..", import.meta.url)), "web");
app.use(express.static(webRoot));

const server = app.listen(config.port, () => {
  console.log(`Streak read side listening on http://localhost:${config.port}`);
  indexer.start();
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown(): void {
  indexer.stop();
  server.close(() => {
    process.exit(0);
  });
}
