import express from "express";
import { getAddress, isAddress } from "viem";
import { loadConfig } from "../config.js";
import { createPool } from "../db/client.js";
import { decodeFeedCursor, encodeFeedCursor } from "../shared/cursor.js";
import { activeCurrentStreak, parseMonthStart } from "../shared/streak.js";

const config = loadConfig();
const pool = createPool(config);
const app = express();

app.use(express.json());

app.get("/health", async (_req, res, next) => {
  try {
    const state = await pool.query(
      "select last_indexed_block, updated_at from indexer_state where id = $1",
      [`${config.CHAIN_ID}:${config.STREAK_CONTRACT_ADDRESS.toLowerCase()}`],
    );
    res.json({
      ok: true,
      chainId: config.CHAIN_ID,
      contractAddress: config.STREAK_CONTRACT_ADDRESS,
      indexer: state.rows[0] ?? null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/feed", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
    const cursor = typeof req.query.before === "string" ? decodeFeedCursor(req.query.before) : null;
    const params: unknown[] = [limit + 1];
    let where = "";

    if (cursor) {
      params.push(cursor.checkedAt, cursor.blockNumber, cursor.logIndex);
      where = `
        where (checked_at, block_number, log_index)
          < ($2::timestamptz, $3::bigint, $4::integer)
      `;
    }

    const result = await pool.query(
      `
      select member, checked_at, note, day_number, transaction_hash, block_number, log_index
      from check_ins
      ${where}
      order by checked_at desc, block_number desc, log_index desc
      limit $1
      `,
      params,
    );

    const rows = result.rows.slice(0, limit);
    const last = rows.at(-1);
    res.json({
      items: rows.map((row) => ({
        member: getAddress(row.member),
        checkedAt: row.checked_at.toISOString(),
        dayNumber: row.day_number,
        note: row.note,
        transactionHash: row.transaction_hash,
      })),
      nextCursor:
        result.rows.length > limit && last
          ? encodeFeedCursor({
              checkedAt: last.checked_at.toISOString(),
              blockNumber: last.block_number,
              logIndex: last.log_index,
            })
          : null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/members/:address", async (req, res, next) => {
  try {
    if (!isAddress(req.params.address)) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }

    const member = getAddress(req.params.address).toLowerCase();
    const result = await pool.query(
      `
      select member, last_check_in_day, current_streak, total_check_ins, last_checked_at
      from members
      where member = $1
      `,
      [member],
    );

    if (!result.rowCount) {
      res.json({
        member: getAddress(member),
        currentStreak: 0,
        totalCheckIns: 0,
        lastCheckInDay: null,
        lastCheckedAt: null,
      });
      return;
    }

    const row = result.rows[0];
    res.json({
      member: getAddress(row.member),
      currentStreak: activeCurrentStreak({
        storedCurrentStreak: row.current_streak,
        lastCheckInDay: row.last_check_in_day,
      }),
      totalCheckIns: row.total_check_ins,
      lastCheckInDay: row.last_check_in_day,
      lastCheckedAt: row.last_checked_at.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/leaderboard", async (req, res, next) => {
  try {
    const monthStart = parseMonthStart(typeof req.query.month === "string" ? req.query.month : undefined);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);
    const result = await pool.query(
      `
      select member, check_in_count, latest_check_in_at
      from monthly_counts
      where month_start = $1::date
      order by check_in_count desc, latest_check_in_at asc, member asc
      limit $2
      `,
      [monthStart, limit],
    );

    res.json({
      month: monthStart.slice(0, 7),
      items: result.rows.map((row, index) => ({
        rank: index + 1,
        member: getAddress(row.member),
        checkIns: row.check_in_count,
        latestCheckInAt: row.latest_check_in_at.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Internal server error";
  const status = message.includes("month") || message.includes("cursor") ? 400 : 500;
  res.status(status).json({ error: message });
});

app.listen(config.PORT, () => {
  console.log(`Streak API listening on http://localhost:${config.PORT}`);
});
