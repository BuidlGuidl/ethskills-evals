import { db } from "ponder:api";
import schema from "ponder:schema";
import { client, desc, eq, graphql, lt } from "ponder";
import { Hono } from "hono";
import { isAddress } from "viem";
import { currentStreak, monthOf } from "../lib/keys.ts";

/**
 * The read side of Streak.
 *
 * Every route here reads the indexed tables, never the chain: the data covers
 * the whole history of the contract because the indexer replayed it from the
 * deployment block, and it stays current because the indexer is still following
 * the head. Nothing here does an `eth_getLogs` per request, so response time
 * does not grow with the age of the contract.
 *
 * Routes:
 *   GET /feed?limit&cursor              global feed, newest first
 *   GET /members/:address               profile: current streak + all-time total
 *   GET /leaderboard?month&limit        top members for a month
 *   /graphql                            auto-generated GraphQL over the schema
 *   /sql/*                              @ponder/client endpoint for typed queries
 */
const app = new Hono();

const MAX_LIMIT = 100;

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

/* ------------------------------------------------------------------ feed --- */

/**
 * Global feed, newest first.
 *
 * Keyset pagination: `cursor` is the `id` of the last row of the previous page
 * and the query walks the primary key backwards. Constant cost per page no
 * matter how far back the reader scrolls, unlike `offset`.
 */
app.get("/feed", async (c) => {
  const limit = parseLimit(c.req.query("limit"), 50);
  const cursor = c.req.query("cursor");

  const rows = await db
    .select()
    .from(schema.checkIn)
    .where(cursor ? lt(schema.checkIn.id, cursor) : undefined)
    .orderBy(desc(schema.checkIn.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? page[page.length - 1]!.id : null;

  return c.json({
    checkIns: page.map((row) => ({
      id: row.id,
      member: row.member,
      note: row.note,
      timestamp: row.timestamp,
      day: row.day,
      streak: row.streak,
      transactionHash: row.transactionHash,
      blockNumber: row.blockNumber.toString(),
    })),
    nextCursor,
  });
});

/* --------------------------------------------------------------- profile --- */

/**
 * Member profile: current streak and all-time total, plus their recent history.
 *
 * `currentStreak` is derived at read time from the day of the last check-in —
 * see the note in ../lib/keys. An address that has never checked in is a normal
 * case (someone opened a profile link), so it returns zeros rather than a 404.
 */
app.get("/members/:address", async (c) => {
  const address = c.req.param("address");
  if (!isAddress(address, { strict: false })) {
    return c.json({ error: "invalid address" }, 400);
  }
  const limit = parseLimit(c.req.query("limit"), 30);

  const [row] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.address, address))
    .limit(1);

  if (!row) {
    return c.json({
      address,
      hasCheckedIn: false,
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      checkedInToday: false,
      firstCheckInAt: null,
      lastCheckInAt: null,
      recentCheckIns: [],
    });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const recent = await db
    .select()
    .from(schema.checkIn)
    .where(eq(schema.checkIn.member, address))
    .orderBy(desc(schema.checkIn.id))
    .limit(limit);

  return c.json({
    address: row.address,
    hasCheckedIn: true,
    currentStreak: currentStreak(row.streakAsOfLastDay, row.lastDay, nowSeconds),
    longestStreak: row.longestStreak,
    totalCheckIns: row.totalCheckIns,
    checkedInToday: row.lastDay === Math.floor(nowSeconds / 86_400),
    firstCheckInAt: row.firstCheckInAt,
    lastCheckInAt: row.lastCheckInAt,
    lastNote: row.lastNote,
    recentCheckIns: recent.map((r) => ({
      id: r.id,
      note: r.note,
      timestamp: r.timestamp,
      day: r.day,
      streak: r.streak,
      transactionHash: r.transactionHash,
    })),
  });
});

/* ----------------------------------------------------------- leaderboard --- */

/**
 * Top members for a month (default: the current UTC month), by check-in count.
 *
 * Reads the pre-aggregated `member_month` table, so this is an indexed
 * `where month = $1 order by check_ins desc limit n` rather than a count over
 * every check-in ever recorded.
 */
app.get("/leaderboard", async (c) => {
  const month = c.req.query("month") ?? monthOf(Math.floor(Date.now() / 1000));
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: "month must be YYYY-MM" }, 400);
  }
  const limit = parseLimit(c.req.query("limit"), 25);

  const rows = await db
    .select({
      member: schema.memberMonth.member,
      checkIns: schema.memberMonth.checkIns,
      lastCheckInAt: schema.memberMonth.lastCheckInAt,
      totalCheckIns: schema.member.totalCheckIns,
      streakAsOfLastDay: schema.member.streakAsOfLastDay,
      longestStreak: schema.member.longestStreak,
      lastDay: schema.member.lastDay,
    })
    .from(schema.memberMonth)
    .innerJoin(schema.member, eq(schema.member.address, schema.memberMonth.member))
    .where(eq(schema.memberMonth.month, month))
    // `lastCheckInAt` breaks ties in favour of whoever got there first.
    .orderBy(desc(schema.memberMonth.checkIns), schema.memberMonth.lastCheckInAt)
    .limit(limit);

  const nowSeconds = Math.floor(Date.now() / 1000);

  return c.json({
    month,
    entries: rows.map((row, i) => ({
      rank: i + 1,
      member: row.member,
      checkIns: row.checkIns,
      totalCheckIns: row.totalCheckIns,
      currentStreak: currentStreak(row.streakAsOfLastDay, row.lastDay, nowSeconds),
      longestStreak: row.longestStreak,
      lastCheckInAt: row.lastCheckInAt,
    })),
  });
});

/* ------------------------------------------------- generic query surfaces --- */

// Auto-generated GraphQL for the same tables, handy for a frontend that would
// rather select its own fields than use the routes above.
app.use("/graphql", graphql({ db, schema }));

// @ponder/client endpoint: lets a frontend run typed, live-updating SQL reads.
app.use("/sql/*", client({ db, schema }));

export default app;
