import "dotenv/config";
import express from "express";
import { migrate, pool } from "./db.js";

const app = express();

app.get("/health", async (_request, response) => {
  const state = await pool.query("SELECT value FROM indexer_state WHERE name = 'next_block'");
  response.json({ ok: true, nextBlock: state.rows[0]?.value ?? null });
});

app.get("/feed", async (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit ?? 30), 1), 100);
  const before = typeof request.query.before === "string" ? request.query.before : null;
  const result = await pool.query(
    `SELECT member, checked_in_at AS "checkedInAt", note, transaction_hash AS "transactionHash"
     FROM checkins WHERE ($1::timestamptz IS NULL OR checked_in_at < $1)
     ORDER BY checked_in_at DESC, block_number DESC, log_index DESC LIMIT $2`,
    [before, limit]
  );
  response.json({ checkins: result.rows, nextCursor: result.rows.at(-1)?.checkedInAt ?? null });
});

app.get("/members/:address", async (request, response) => {
  const member = request.params.address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(member)) return response.status(400).json({ error: "invalid Base address" });
  const result = await pool.query(
    `WITH ordered AS (
       SELECT day, row_number() OVER (ORDER BY day DESC) AS n FROM checkins WHERE member = $1
     ), current AS (
       SELECT count(*)::int AS streak FROM ordered WHERE day = (SELECT max(day) FROM ordered) - (n - 1)
     )
     SELECT (SELECT streak FROM current) AS "currentStreak", count(*)::int AS "totalCheckIns",
       max(checked_in_at) AS "lastCheckInAt" FROM checkins WHERE member = $1`,
    [member]
  );
  response.json({ member, ...result.rows[0] });
});

app.get("/leaderboard/month", async (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit ?? 100), 1), 250);
  const result = await pool.query(
    `SELECT member, count(*)::int AS "checkIns"
     FROM checkins
     WHERE checked_in_at >= date_trunc('month', now() AT TIME ZONE 'UTC')
       AND checked_in_at < date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month'
     GROUP BY member ORDER BY "checkIns" DESC, member ASC LIMIT $1`, [limit]
  );
  response.json({ month: new Date().toISOString().slice(0, 7), members: result.rows });
});

async function main() {
  await migrate();
  app.listen(Number(process.env.PORT ?? 3000), () => console.info("API listening"));
}
main().catch(error => { console.error(error); process.exit(1); });
