import express from "express";
import { db } from "./db.js";
import { syncOnce } from "./sync.js";
import { config } from "./config.js";

const app = express();
const limit = (value: unknown) => Math.min(Math.max(Number(value) || 25, 1), 100);

app.get("/health", async (_request, response) => {
  const cursor = await db.query("SELECT value FROM indexer_state WHERE key = 'next_block'");
  response.json({ ok: true, nextBlock: cursor.rows[0]?.value ?? config.startBlock.toString() });
});

app.get("/feed", async (request, response) => {
  const rows = await db.query(
    `SELECT member, note, block_timestamp AS "checkedInAt", transaction_hash AS "transactionHash"
     FROM checkins ORDER BY block_timestamp DESC, block_number DESC, log_index DESC LIMIT $1`, [limit(request.query.limit)],
  );
  response.json(rows.rows);
});

app.get("/members/:address", async (request, response) => {
  const member = request.params.address.toLowerCase();
  const profile = await db.query(
    `WITH ordered AS (
       SELECT day, day - row_number() OVER (ORDER BY day DESC) AS grp FROM checkins WHERE member = $1
     ), current_run AS (
       SELECT count(*)::int AS streak FROM ordered WHERE grp = (SELECT grp FROM ordered LIMIT 1)
     )
     SELECT (SELECT count(*)::int FROM checkins WHERE member = $1) AS "totalCheckins",
            CASE WHEN (SELECT max(day) FROM checkins WHERE member = $1) >= floor(extract(epoch FROM now()) / 86400)::bigint - 1
              THEN COALESCE((SELECT streak FROM current_run), 0) ELSE 0 END AS "currentStreak"`, [member],
  );
  response.json({ member, ...profile.rows[0] });
});

app.get("/leaderboard/month", async (request, response) => {
  // month=YYYY-MM is UTC. Omitting it means the current UTC calendar month.
  const month = typeof request.query.month === "string" ? request.query.month : new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return response.status(400).json({ error: "month must be YYYY-MM" });
  const rows = await db.query(
    `SELECT member, count(*)::int AS "checkins"
     FROM checkins
     WHERE block_timestamp >= ($1 || '-01')::date
       AND block_timestamp < (($1 || '-01')::date + INTERVAL '1 month')
     GROUP BY member ORDER BY "checkins" DESC, member ASC LIMIT $2`, [month, limit(request.query.limit)],
  );
  response.json({ month, members: rows.rows });
});

const start = async () => {
  await syncOnce(); // first boot backfills from STREAK_START_BLOCK; later boots tail safely.
  setInterval(() => syncOnce().catch(console.error), 15_000).unref();
  app.listen(config.port, () => console.log(`Streak read API listening on :${config.port}`));
};
start().catch(error => { console.error(error); process.exit(1); });
