import express from "express";
import { getAddress } from "viem";
import { config } from "./config.js";
import { openDatabase, monthFromTimestamp } from "./database.js";

const db = openDatabase(config.databasePath);
const app = express();

function limit(value: unknown) {
  return Math.min(Math.max(Number(value) || 50, 1), 100);
}

app.get("/health", (_request, response) => {
  const indexed = db.prepare("SELECT value FROM metadata WHERE key = 'last_block'").get();
  response.json({ ok: true, indexed });
});

app.get("/feed", (request, response) => {
  const beforeBlock = Number(request.query.beforeBlock ?? Number.MAX_SAFE_INTEGER);
  const beforeLog = Number(request.query.beforeLog ?? Number.MAX_SAFE_INTEGER);
  const rows = db.prepare(`
    SELECT member, day, note, timestamp, block_number AS blockNumber,
      transaction_hash AS transactionHash, log_index AS logIndex
    FROM check_ins
    WHERE block_number < ? OR (block_number = ? AND log_index < ?)
    ORDER BY block_number DESC, log_index DESC LIMIT ?
  `).all(beforeBlock, beforeBlock, beforeLog, limit(request.query.limit));
  response.json({ checkIns: rows });
});

app.get("/members/:address", (request, response) => {
  try {
    const address = getAddress(request.params.address).toLowerCase();
    const today = Math.floor(Date.now() / 1000 / 86400);
    const member = db.prepare(`SELECT address, total,
      CASE WHEN last_day >= ? - 1 THEN current_streak ELSE 0 END AS currentStreak,
      last_day AS lastDay, last_timestamp AS lastTimestamp
      FROM members WHERE address = ?`).get(today, address);
    if (!member) return response.status(404).json({ error: "Member not found" });
    response.json(member);
  } catch { response.status(400).json({ error: "Invalid address" }); }
});

app.get("/leaderboard", (request, response) => {
  const month = typeof request.query.month === "string"
    ? request.query.month
    : monthFromTimestamp(Math.floor(Date.now() / 1000));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return response.status(400).json({ error: "month must be YYYY-MM" });
  const members = db.prepare(`SELECT member, count FROM monthly_counts
    WHERE month = ? ORDER BY count DESC, member ASC LIMIT ?`).all(month, limit(request.query.limit));
  response.json({ month, members });
});

app.listen(config.port, () => console.log(`Streak API listening on :${config.port}`));
