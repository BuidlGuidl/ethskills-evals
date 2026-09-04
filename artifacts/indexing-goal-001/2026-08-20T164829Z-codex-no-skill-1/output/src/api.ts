import express from "express";
import { isAddress } from "viem";
import { db, migrate } from "./db.js";
import { config } from "./config.js";

const app = express();
const pageSize = 50;

app.get("/feed", async (request, response) => {
  const beforeBlock = String(request.query.beforeBlock ?? "9223372036854775807");
  const beforeLogIndex = Number(request.query.beforeLogIndex ?? 2147483647);
  if (!/^\d+$/.test(beforeBlock) || !Number.isInteger(beforeLogIndex)) {
    return response.status(400).json({ error: "Invalid feed cursor" });
  }
  const result = await db.query(
    `SELECT member, note, day, block_timestamp AS "checkedInAt", block_number AS "blockNumber", log_index AS "logIndex"
     FROM checkins WHERE (block_number, log_index) < ($1::bigint, $2)
     ORDER BY block_number DESC, log_index DESC LIMIT $3`,
    [beforeBlock, beforeLogIndex, pageSize],
  );
  response.json({ checkins: result.rows });
});

app.get("/members/:address", async (request, response) => {
  if (!isAddress(request.params.address)) return response.status(400).json({ error: "Invalid address" });
  const member = request.params.address.toLowerCase();
  const result = await db.query<{ total: string; streak: string }>(
    `WITH ordered AS (
       SELECT day, day + row_number() OVER (ORDER BY day DESC) AS grp FROM checkins WHERE member = $1
     ), latest AS (SELECT max(day) AS last_day FROM checkins WHERE member = $1), latest_group AS (
       SELECT grp FROM ordered ORDER BY day DESC LIMIT 1
     )
     SELECT (SELECT count(*) FROM checkins WHERE member = $1)::text AS total,
       COALESCE((SELECT count(*) FROM ordered WHERE grp = (SELECT grp FROM latest_group)
         AND (SELECT last_day FROM latest) >= floor(extract(epoch FROM now()) / 86400)::bigint - 1), 0)::text AS streak`,
    [member],
  );
  response.json({ member, totalCheckIns: Number(result.rows[0].total), currentStreak: Number(result.rows[0].streak) });
});

app.get("/leaderboard/month", async (_request, response) => {
  const result = await db.query(
    `SELECT member, count(*)::int AS "checkIns" FROM checkins
     WHERE block_timestamp >= date_trunc('month', now() AT TIME ZONE 'UTC')
       AND block_timestamp < date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month'
     GROUP BY member ORDER BY "checkIns" DESC, member ASC LIMIT 100`,
  );
  response.json({ month: new Date().toISOString().slice(0, 7), members: result.rows });
});

migrate().then(() => app.listen(config.port, () => console.log(`Streak API on :${config.port}`)));
