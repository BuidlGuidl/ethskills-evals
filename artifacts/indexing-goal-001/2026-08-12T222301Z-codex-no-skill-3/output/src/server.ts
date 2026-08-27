import { createServer } from "node:http";
import { config } from "./config.js";
import { openDb } from "./db.js";
import { backfill, syncOnce } from "./indexer.js";
import { feed, memberProfile, monthlyLeaderboard } from "./queries.js";

const db = openDb(config.dbPath);
await backfill(db);

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/health") return json(res, 200, { ok: true });
    if (url.pathname === "/api/feed") return json(res, 200, feed(db,
      Number(url.searchParams.get("limit") ?? 50),
      url.searchParams.has("beforeBlock") ? Number(url.searchParams.get("beforeBlock")) : undefined,
      url.searchParams.has("beforeLog") ? Number(url.searchParams.get("beforeLog")) : undefined));
    const profileMatch = url.pathname.match(/^\/api\/members\/(0x[0-9a-fA-F]{40})$/);
    if (profileMatch) return json(res, 200, memberProfile(db, profileMatch[1], Math.floor(Date.now() / 86_400_000)));
    if (url.pathname === "/api/leaderboard") {
      const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
      return json(res, 200, { month, members: monthlyLeaderboard(db, month) });
    }
    return json(res, 404, { error: "not found" });
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : "bad request" });
  }
}).listen(config.port, () => console.log(`Streak API listening on :${config.port}`));

setInterval(() => void syncOnce(db).catch(console.error), config.pollIntervalMs).unref();
