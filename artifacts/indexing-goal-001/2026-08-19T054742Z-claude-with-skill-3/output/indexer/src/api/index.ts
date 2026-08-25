import { db } from "ponder:api";
import * as schema from "ponder:schema";
import { and, client, count, desc, eq, graphql, gt, lt } from "ponder";
import { Hono } from "hono";

import { currentDay, currentMonth, liveStreak } from "../time";

const app = new Hono();

/** Generic access, useful for exploring: GraphQL and @ponder/client over SQL. */
app.use("/graphql", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

const MAX_LIMIT = 100;
const clampLimit = (raw: string | undefined, fallback: number) => {
  const n = Number(raw ?? fallback);
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT) : fallback;
};

const serializeCheckIn = (row: typeof schema.checkIn.$inferSelect) => ({
  id: row.id,
  member: row.member,
  note: row.note,
  streak: row.streak,
  memberTotal: row.memberTotal,
  day: row.day,
  timestamp: row.timestamp,
  transactionHash: row.transactionHash,
  cursor: row.ordinal.toString(),
});

/**
 * Screen 1 -- global feed, newest first, across everyone and all of history.
 * Keyset pagination: pass the last item's `cursor` back as `?cursor=`.
 */
app.get("/feed", async (c) => {
  const limit = clampLimit(c.req.query("limit"), 25);
  const cursor = c.req.query("cursor");

  const rows = await db
    .select()
    .from(schema.checkIn)
    .where(cursor ? lt(schema.checkIn.ordinal, BigInt(cursor)) : undefined)
    .orderBy(desc(schema.checkIn.ordinal))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return c.json({
    items: page.map(serializeCheckIn),
    nextCursor: rows.length > limit ? page.at(-1)!.ordinal.toString() : null,
  });
});

/**
 * Screen 2 -- member profile: current streak and all-time total, plus that
 * member's recent notes. The two numbers are also readable straight from the
 * contract (`Streak.getMember`); the frontend prefers that call and uses this
 * route for the note history. See app/readSide.ts.
 */
app.get("/members/:address", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;
  const limit = clampLimit(c.req.query("limit"), 25);

  const [row] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.address, address))
    .limit(1);

  if (!row) {
    return c.json({
      address,
      currentStreak: 0,
      totalCheckIns: 0,
      longestStreak: 0,
      firstCheckInAt: null,
      lastCheckInAt: null,
      checkedInToday: false,
      recentCheckIns: [],
    });
  }

  const today = currentDay();
  const recent = await db
    .select()
    .from(schema.checkIn)
    .where(eq(schema.checkIn.member, address))
    .orderBy(desc(schema.checkIn.ordinal))
    .limit(limit);

  return c.json({
    address: row.address,
    currentStreak: liveStreak(row.lastDay, row.streakAtLastDay, today),
    totalCheckIns: row.totalCheckIns,
    longestStreak: row.longestStreak,
    firstCheckInAt: row.firstCheckInAt,
    lastCheckInAt: row.lastCheckInAt,
    checkedInToday: row.lastDay === today,
    recentCheckIns: recent.map(serializeCheckIn),
  });
});

/**
 * Screen 3 -- leaderboard: top members this month by check-in count. Defaults to
 * the current UTC month; pass `?month=YYYY-MM` for any past month.
 */
app.get("/leaderboard", async (c) => {
  const month = c.req.query("month") ?? currentMonth();
  const limit = clampLimit(c.req.query("limit"), 20);

  const rows = await db
    .select({
      member: schema.memberMonth.member,
      checkIns: schema.memberMonth.checkIns,
      lastCheckInAt: schema.memberMonth.lastCheckInAt,
      streakAtLastDay: schema.member.streakAtLastDay,
      lastDay: schema.member.lastDay,
      totalCheckIns: schema.member.totalCheckIns,
    })
    .from(schema.memberMonth)
    .innerJoin(schema.member, eq(schema.member.address, schema.memberMonth.member))
    .where(eq(schema.memberMonth.month, month))
    .orderBy(desc(schema.memberMonth.checkIns), desc(schema.memberMonth.lastCheckInAt))
    .limit(limit);

  const today = currentDay();
  return c.json({
    month,
    items: rows.map((row, i) => ({
      rank: i + 1,
      member: row.member,
      checkInsThisMonth: row.checkIns,
      totalCheckIns: row.totalCheckIns,
      currentStreak: liveStreak(row.lastDay, row.streakAtLastDay, today),
    })),
  });
});

/** Where is a given member on this month's leaderboard? */
app.get("/leaderboard/:address", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;
  const month = c.req.query("month") ?? currentMonth();

  const [row] = await db
    .select()
    .from(schema.memberMonth)
    .where(and(eq(schema.memberMonth.month, month), eq(schema.memberMonth.member, address)))
    .limit(1);

  if (!row) return c.json({ month, address, checkInsThisMonth: 0, rank: null });

  // Rank = how many members are ahead of them this month, + 1 (ties share a rank).
  const [{ ahead }] = await db
    .select({ ahead: count() })
    .from(schema.memberMonth)
    .where(and(eq(schema.memberMonth.month, month), gt(schema.memberMonth.checkIns, row.checkIns)));

  const rank = Number(ahead) + 1;
  return c.json({ month, address, checkInsThisMonth: row.checkIns, rank });
});

export default app;
