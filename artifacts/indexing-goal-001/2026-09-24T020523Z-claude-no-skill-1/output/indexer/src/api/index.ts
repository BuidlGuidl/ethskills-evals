import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { and, asc, client, count, desc, eq, graphql, lt, or, sql } from "ponder";

const app = new Hono();

// Built-in endpoints: raw SQL over HTTP (@ponder/client) and GraphQL.
app.use("/sql/*", client({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

const SECONDS_PER_DAY = 86_400;
const todayIndex = () => Math.floor(Date.now() / 1000 / SECONDS_PER_DAY);
const currentMonth = () => new Date().toISOString().slice(0, 7);

/** A streak is alive only if the member checked in today or yesterday. */
function liveStreak(lastDay: number, streakAtLastCheckIn: number): number {
  const today = todayIndex();
  return lastDay === today || lastDay + 1 === today ? streakAtLastCheckIn : 0;
}

function clampLimit(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/** Keyset cursor: "<blockNumber>:<logIndex>", the exact feed sort key. */
function decodeCursor(cursor: string | undefined): { blockNumber: bigint; logIndex: number } | null {
  if (!cursor) return null;
  const [block, log] = cursor.split(":");
  if (block === undefined || log === undefined) return null;
  try {
    return { blockNumber: BigInt(block), logIndex: Number(log) };
  } catch {
    return null;
  }
}

type FeedRow = typeof schema.checkIn.$inferSelect;

const feedItem = (row: FeedRow) => ({
  id: row.id,
  member: row.member,
  note: row.note,
  timestamp: row.timestamp,
  day: row.day,
  streak: row.streak,
  memberTotal: row.memberTotal,
  transactionHash: row.transactionHash,
  blockNumber: row.blockNumber.toString(),
  cursor: `${row.blockNumber}:${row.logIndex}`,
});

/**
 * Screen 1 — global feed, newest first, across every member and all of history.
 * GET /feed?limit=50&cursor=<cursor>&member=0x...
 */
app.get("/feed", async (c) => {
  const limit = clampLimit(c.req.query("limit"), 50, 200);
  const cursor = decodeCursor(c.req.query("cursor"));
  const memberFilter = c.req.query("member")?.toLowerCase() as `0x${string}` | undefined;

  const filters = [
    cursor
      ? or(
          lt(schema.checkIn.blockNumber, cursor.blockNumber),
          and(eq(schema.checkIn.blockNumber, cursor.blockNumber), lt(schema.checkIn.logIndex, cursor.logIndex)),
        )
      : undefined,
    memberFilter ? eq(schema.checkIn.member, memberFilter) : undefined,
  ].filter((f) => f !== undefined);

  const rows = await db
    .select()
    .from(schema.checkIn)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.checkIn.blockNumber), desc(schema.checkIn.logIndex))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return c.json({
    items: page.map(feedItem),
    nextCursor: rows.length > limit && last ? `${last.blockNumber}:${last.logIndex}` : null,
  });
});

/**
 * Screen 2 — member profile: current streak (consecutive days) and all-time total,
 * both derived from the complete log history.
 * GET /members/:address?recent=10
 */
app.get("/members/:address", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return c.json({ error: "invalid address" }, 400);
  }
  const recentLimit = clampLimit(c.req.query("recent"), 10, 100);

  const [row] = await db.select().from(schema.member).where(eq(schema.member.address, address)).limit(1);

  if (!row) {
    return c.json({
      address,
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      checkedInToday: false,
      firstCheckInAt: null,
      lastCheckInAt: null,
      thisMonthCheckIns: 0,
      recent: [],
    });
  }

  const [thisMonth] = await db
    .select()
    .from(schema.memberMonth)
    .where(and(eq(schema.memberMonth.member, address), eq(schema.memberMonth.month, currentMonth())))
    .limit(1);

  const recent = await db
    .select()
    .from(schema.checkIn)
    .where(eq(schema.checkIn.member, address))
    .orderBy(desc(schema.checkIn.blockNumber), desc(schema.checkIn.logIndex))
    .limit(recentLimit);

  return c.json({
    address,
    currentStreak: liveStreak(row.lastDay, row.streakAtLastCheckIn),
    longestStreak: row.longestStreak,
    totalCheckIns: row.totalCheckIns,
    checkedInToday: row.lastDay === todayIndex(),
    firstCheckInAt: row.firstCheckInAt,
    lastCheckInAt: row.lastCheckInAt,
    lastNote: row.lastNote,
    thisMonthCheckIns: thisMonth?.checkIns ?? 0,
    recent: recent.map(feedItem),
  });
});

/**
 * Screen 3 — leaderboard: most check-ins in a calendar month (UTC), current month
 * by default. Ties broken by whoever got there first.
 * GET /leaderboard?month=YYYY-MM&limit=25&offset=0
 */
app.get("/leaderboard", async (c) => {
  const month = c.req.query("month") ?? currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: "month must be YYYY-MM" }, 400);
  }
  const limit = clampLimit(c.req.query("limit"), 25, 200);
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);

  const rows = await db
    .select({
      member: schema.memberMonth.member,
      checkIns: schema.memberMonth.checkIns,
      lastCheckInAt: schema.memberMonth.lastCheckInAt,
      currentStreak: schema.member.streakAtLastCheckIn,
      lastDay: schema.member.lastDay,
      totalCheckIns: schema.member.totalCheckIns,
    })
    .from(schema.memberMonth)
    .innerJoin(schema.member, eq(schema.member.address, schema.memberMonth.member))
    .where(eq(schema.memberMonth.month, month))
    .orderBy(desc(schema.memberMonth.checkIns), asc(schema.memberMonth.lastCheckInAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    month,
    entries: rows.map((row, i) => ({
      rank: offset + i + 1,
      member: row.member,
      checkIns: row.checkIns,
      currentStreak: liveStreak(row.lastDay, row.currentStreak),
      totalCheckIns: row.totalCheckIns,
      lastCheckInAt: row.lastCheckInAt,
    })),
  });
});

/** Small header/footer stats, handy for all three screens. */
app.get("/stats", async (c) => {
  const [totals] = await db
    .select({ checkIns: count(), members: sql<number>`count(distinct ${schema.checkIn.member})` })
    .from(schema.checkIn);
  const [todayRow] = await db
    .select({ checkIns: count() })
    .from(schema.checkIn)
    .where(eq(schema.checkIn.day, todayIndex()));

  return c.json({
    totalCheckIns: Number(totals?.checkIns ?? 0),
    totalMembers: Number(totals?.members ?? 0),
    checkInsToday: Number(todayRow?.checkIns ?? 0),
    month: currentMonth(),
  });
});

export default app;
