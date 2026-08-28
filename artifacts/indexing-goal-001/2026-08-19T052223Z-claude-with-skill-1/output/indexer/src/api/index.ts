import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, desc, eq, graphql, lt, sql } from "ponder";
import { Hono } from "hono";
import { cors } from "hono/cors";

/**
 * The read side of Streak: three endpoints, one per screen. Every one of them
 * is a single indexed Postgres query against the full backfilled history — no
 * `eth_getLogs`, no archive-node reads, no work that grows with chain length.
 */
const app = new Hono();

app.use("/*", cors());

const SECONDS_PER_DAY = 86_400;

/** UTC day index for "now", the same unit the contract emits. */
const today = () => Math.floor(Date.now() / 1000 / SECONDS_PER_DAY);

/** UTC month key (YYYYMM) for "now", the same unit the contract emits. */
const thisMonth = () => {
  const d = new Date();
  return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1;
};

/**
 * The live streak. The contract stores the streak *as of the last check-in*;
 * it silently decays once a whole day has been missed, and nothing onchain
 * emits that decay — there is no "streak broken" event to index. So the rule is
 * applied here, against the wall clock, exactly as `Streak.currentStreak` does.
 */
const liveStreak = (lastDay: number, streakAtLastCheckIn: number) => {
  const t = today();
  return lastDay === t || lastDay === t - 1 ? streakAtLastCheckIn : 0;
};

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));

const feedItem = (row: typeof schema.checkIn.$inferSelect) => ({
  id: row.id,
  cursor: row.seq.toString(),
  member: row.member,
  note: row.note,
  timestamp: Number(row.timestamp),
  day: row.day,
  month: row.month,
  streak: row.streak,
  total: row.total,
  blockNumber: row.blockNumber.toString(),
  transactionHash: row.transactionHash,
});

/**
 * SCREEN 1 — global feed, newest first.
 * GET /feed?limit=50&cursor=<nextCursor from the previous page>
 *
 * Keyset pagination on the monotonic `seq`, so page 200 costs the same as
 * page 1 and new check-ins arriving at the head never shift a page boundary.
 */
app.get("/feed", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
  const cursor = c.req.query("cursor");
  const memberFilter = c.req.query("member")?.toLowerCase() as `0x${string}` | undefined;

  const conditions = [];
  if (cursor) conditions.push(lt(schema.checkIn.seq, BigInt(cursor)));
  if (memberFilter) conditions.push(eq(schema.checkIn.member, memberFilter));

  const rows = await db
    .select()
    .from(schema.checkIn)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.checkIn.seq))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return c.json({
    items: page.map(feedItem),
    nextCursor: rows.length > limit ? (page[page.length - 1]?.seq.toString() ?? null) : null,
  });
});

/**
 * SCREEN 2 — member profile: current streak + all-time total.
 * GET /members/:address?recent=10
 *
 * Note this is history, pre-aggregated at index time. The same two numbers for
 * a *single* member are also one plain contract call (`Streak.profileOf`), and
 * many members at once are one Multicall3 batch — use those when you want the
 * pending-block truth without waiting for the indexer to catch up.
 */
app.get("/members/:address", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;
  const recent = Math.min(Number(c.req.query("recent") ?? 10) || 10, 50);

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
      recentCheckIns: [],
    });
  }

  const recentCheckIns = await db
    .select()
    .from(schema.checkIn)
    .where(eq(schema.checkIn.member, address))
    .orderBy(desc(schema.checkIn.seq))
    .limit(recent);

  const [monthRow] = await db
    .select()
    .from(schema.memberMonth)
    .where(and(eq(schema.memberMonth.member, address), eq(schema.memberMonth.month, thisMonth())))
    .limit(1);

  return c.json({
    address,
    currentStreak: liveStreak(row.lastDay, row.streakAtLastCheckIn),
    longestStreak: row.longestStreak,
    totalCheckIns: row.totalCheckIns,
    checkInsThisMonth: monthRow?.checkIns ?? 0,
    checkedInToday: row.lastDay === today(),
    firstCheckInAt: Number(row.firstCheckInAt),
    lastCheckInAt: Number(row.lastCheckInAt),
    lastNote: row.lastNote,
    recentCheckIns: recentCheckIns.map(feedItem),
  });
});

/**
 * SCREEN 3 — leaderboard: top members this month by check-in count.
 * GET /leaderboard?month=202608&limit=25
 *
 * Served from `member_month`, which is incremented as events are indexed, so
 * this is an index scan over one month's rows — not a count over all history.
 */
app.get("/leaderboard", async (c) => {
  const month = Number(c.req.query("month") ?? thisMonth());
  const limit = Math.min(Number(c.req.query("limit") ?? 25) || 25, 100);

  const rows = await db
    .select({
      member: schema.memberMonth.member,
      checkIns: schema.memberMonth.checkIns,
      bestStreak: schema.memberMonth.bestStreak,
      lastCheckInAt: schema.memberMonth.lastCheckInAt,
      totalCheckIns: schema.member.totalCheckIns,
      lastDay: schema.member.lastDay,
      streakAtLastCheckIn: schema.member.streakAtLastCheckIn,
    })
    .from(schema.memberMonth)
    .innerJoin(schema.member, eq(schema.member.address, schema.memberMonth.member))
    .where(eq(schema.memberMonth.month, month))
    // Ties broken by whoever got there first this month.
    .orderBy(desc(schema.memberMonth.checkIns), schema.memberMonth.lastCheckInAt)
    .limit(limit);

  return c.json({
    month,
    entries: rows.map((row, i) => ({
      rank: i + 1,
      member: row.member,
      checkIns: row.checkIns,
      bestStreakThisMonth: row.bestStreak,
      currentStreak: liveStreak(row.lastDay, row.streakAtLastCheckIn),
      totalCheckIns: row.totalCheckIns,
    })),
  });
});

/** Community-wide totals, handy for a header. */
app.get("/stats", async (c) => {
  const [totals] = await db
    .select({
      members: sql<number>`count(*)::int`,
      checkIns: sql<number>`coalesce(sum(${schema.member.totalCheckIns}), 0)::int`,
    })
    .from(schema.member);

  const [activeToday] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.member)
    .where(eq(schema.member.lastDay, today()));

  return c.json(
    json({
      members: totals?.members ?? 0,
      checkIns: totals?.checkIns ?? 0,
      activeToday: activeToday?.count ?? 0,
      month: thisMonth(),
    }),
  );
});

// Ad-hoc queries over the same tables, for debugging and for anything the three
// endpoints above don't cover.
app.use("/graphql", graphql({ db, schema }));

export default app;
