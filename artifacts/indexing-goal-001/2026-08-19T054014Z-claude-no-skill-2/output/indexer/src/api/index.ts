import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { asc, client, desc, eq, graphql, sql } from "ponder";
import { getAddress, isAddress } from "viem";
import { decodeCursor, encodeCursor } from "../cursor";
import {
  currentDayIndex,
  currentMonthKey,
  liveStreak,
  SECONDS_PER_DAY,
} from "../time";

/**
 * HTTP API for the three screens.
 *
 *   GET /feed                    global feed, newest first, cursor-paginated
 *   GET /members/:address        profile: current streak + all-time total
 *   GET /leaderboard             top members this month by check-ins
 *
 * Every one of these reads from the indexed tables, which cover the contract's
 * full history from its deployment block — not just events seen since the
 * process started.
 */
const app = new Hono();

const MAX_LIMIT = 100;

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, MAX_LIMIT);
}

const serializeCheckIn = (row: typeof schema.checkIn.$inferSelect) => ({
  id: row.id,
  member: row.member,
  note: row.note,
  day: row.day,
  timestamp: Number(row.timestamp),
  time: new Date(Number(row.timestamp) * 1000).toISOString(),
  streak: row.streak,
  total: row.total,
  blockNumber: Number(row.blockNumber),
  transactionHash: row.transactionHash,
});

/* ------------------------------------------------------------------ */
/* Screen 1: the global feed                                          */
/* ------------------------------------------------------------------ */

app.get("/feed", async (c) => {
  const limit = parseLimit(c.req.query("limit"), 25);
  const rawCursor = c.req.query("cursor");

  let where = undefined;
  if (rawCursor) {
    const cursor = decodeCursor(rawCursor);
    if (!cursor) return c.json({ error: "Invalid cursor" }, 400);
    // Row-value comparison: strictly older than the cursor position.
    where = sql`(${schema.checkIn.blockNumber}, ${schema.checkIn.logIndex}) < (${cursor.blockNumber}, ${cursor.logIndex})`;
  }

  // Fetch one extra row to find out whether another page exists.
  const rows = await db
    .select()
    .from(schema.checkIn)
    .where(where)
    .orderBy(desc(schema.checkIn.blockNumber), desc(schema.checkIn.logIndex))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];

  return c.json({
    items: page.map(serializeCheckIn),
    nextCursor:
      rows.length > limit && last ? encodeCursor(last.blockNumber, last.logIndex) : null,
  });
});

/* ------------------------------------------------------------------ */
/* Screen 2: a member's profile                                       */
/* ------------------------------------------------------------------ */

app.get("/members/:address", async (c) => {
  const raw = c.req.param("address");
  if (!isAddress(raw)) return c.json({ error: "Invalid address" }, 400);
  const address = getAddress(raw);

  const [row] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.address, address))
    .limit(1);

  const today = currentDayIndex();

  if (!row) {
    // A member who has never checked in is a valid, empty profile rather than
    // a 404 — the profile screen is reachable for any address. Same keys as a
    // populated profile so the client needs only one code path.
    return c.json({
      address,
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      checkedInToday: false,
      daysSinceLastCheckIn: null,
      firstCheckInAt: null,
      lastCheckInAt: null,
      memberSince: null,
      lastNote: null,
      recentCheckIns: [],
    });
  }

  const recentLimit = parseLimit(c.req.query("recent"), 10);
  const recent = await db
    .select()
    .from(schema.checkIn)
    .where(eq(schema.checkIn.member, address))
    .orderBy(desc(schema.checkIn.blockNumber), desc(schema.checkIn.logIndex))
    .limit(recentLimit);

  return c.json({
    address,
    // The headline number: streaks lapse with wall-clock time, so it is
    // derived per request rather than read straight out of the table.
    currentStreak: liveStreak(row.streak, row.lastDay, today),
    longestStreak: row.longestStreak,
    totalCheckIns: row.total,
    checkedInToday: row.lastDay === today,
    /** Days since the last check-in; 0 means "already checked in today". */
    daysSinceLastCheckIn: today - row.lastDay,
    firstCheckInAt: Number(row.firstCheckInAt),
    lastCheckInAt: Number(row.lastCheckInAt),
    memberSince: new Date(Number(row.firstCheckInAt) * 1000).toISOString(),
    lastNote: row.lastNote,
    recentCheckIns: recent.map(serializeCheckIn),
  });
});

/* ------------------------------------------------------------------ */
/* Screen 3: this month's leaderboard                                 */
/* ------------------------------------------------------------------ */

app.get("/leaderboard", async (c) => {
  const month = c.req.query("month") ?? currentMonthKey();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: "Invalid month, expected YYYY-MM" }, 400);
  }
  const limit = parseLimit(c.req.query("limit"), 25);

  const rows = await db
    .select({
      member: schema.memberMonth.member,
      checkIns: schema.memberMonth.checkIns,
      firstCheckInAt: schema.memberMonth.firstCheckInAt,
      lastCheckInAt: schema.memberMonth.lastCheckInAt,
      streak: schema.member.streak,
      lastDay: schema.member.lastDay,
      total: schema.member.total,
    })
    .from(schema.memberMonth)
    .leftJoin(schema.member, eq(schema.member.address, schema.memberMonth.member))
    .where(eq(schema.memberMonth.month, month))
    // Ties go to whoever got there first, so ranks are stable between requests.
    .orderBy(desc(schema.memberMonth.checkIns), asc(schema.memberMonth.firstCheckInAt))
    .limit(limit);

  const today = currentDayIndex();

  return c.json({
    month,
    entries: rows.map((row, i) => ({
      rank: i + 1,
      member: row.member,
      checkIns: row.checkIns,
      currentStreak: row.streak === null ? 0 : liveStreak(row.streak, row.lastDay ?? 0, today),
      totalCheckIns: row.total ?? row.checkIns,
      lastCheckInAt: Number(row.lastCheckInAt),
    })),
  });
});

/* ------------------------------------------------------------------ */
/* Extras                                                             */
/* ------------------------------------------------------------------ */

/** Small summary for a header bar: totals across all of history. */
app.get("/stats", async (c) => {
  const [totals] = await db
    .select({
      checkIns: sql<number>`count(*)::int`,
      members: sql<number>`count(distinct ${schema.checkIn.member})::int`,
      firstCheckInAt: sql<string | null>`min(${schema.checkIn.timestamp})`,
      lastCheckInAt: sql<string | null>`max(${schema.checkIn.timestamp})`,
    })
    .from(schema.checkIn);

  const today = currentDayIndex();
  const [todayRow] = await db
    .select({ checkIns: sql<number>`count(*)::int` })
    .from(schema.checkIn)
    .where(eq(schema.checkIn.day, today));

  return c.json({
    totalCheckIns: totals?.checkIns ?? 0,
    totalMembers: totals?.members ?? 0,
    checkInsToday: todayRow?.checkIns ?? 0,
    firstCheckInAt: totals?.firstCheckInAt ? Number(totals.firstCheckInAt) : null,
    lastCheckInAt: totals?.lastCheckInAt ? Number(totals.lastCheckInAt) : null,
    today,
    dayStartsAt: today * SECONDS_PER_DAY,
  });
});

// GraphQL over the same tables, for exploring the data.
app.use("/graphql", graphql({ db, schema }));
// SQL-over-HTTP endpoint for `@ponder/client`, which gives the frontend live
// queries (the feed updates without a manual refresh).
app.use("/sql/*", client({ db, schema }));

export default app;
