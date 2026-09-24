import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, client, desc, eq, graphql, gt, lt } from "ponder";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAddress, isAddress } from "viem";
import { currentMonth, dateOf, dayStart, liveStreak, monthOf, today } from "../days";

/**
 * The read API behind the three screens.
 *
 * Every route here is a bounded, indexed query against tables the indexer has
 * already filled from the contract's full history — no RPC calls, no log scans,
 * no work proportional to how old the contract is.
 *
 * Also mounted: /graphql (auto-generated from the schema) and /sql (for
 * @ponder/client), so a frontend can query beyond these routes without waiting
 * on a new endpoint.
 */
const app = new Hono();

app.use("/*", cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use("/graphql", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

const MAX_LIMIT = 100;

function parseLimit(raw: string | undefined, fallback: number) {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

/** Shape a check-in row for the wire: day indices become dates, bigints strings. */
function toFeedItem(row: typeof schema.checkIn.$inferSelect) {
  return {
    id: row.id,
    member: getAddress(row.member),
    note: row.note,
    day: row.day,
    date: dateOf(row.day),
    timestamp: row.timestamp,
    time: new Date(row.timestamp * 1000).toISOString(),
    streakAfter: row.streakAfter,
    totalAfter: row.totalAfter,
    blockNumber: row.blockNumber.toString(),
    transactionHash: row.transactionHash,
    cursor: row.ordinal.toString(),
  };
}

/**
 * Screen 1 — global feed, newest first.
 *
 * Keyset pagination on `ordinal` (blockNumber<<16|logIndex): the cursor is the
 * last row's ordinal, so page N costs the same as page 1. OFFSET would make
 * deep scrollback slower the longer the history gets, and would skip or repeat
 * rows whenever a new check-in lands mid-scroll.
 *
 * GET /feed?limit=50&before=<cursor>   older than cursor (scroll down)
 * GET /feed?limit=50&after=<cursor>    newer than cursor (poll for new)
 */
app.get("/feed", async (c) => {
  const limit = parseLimit(c.req.query("limit"), 50);
  const before = c.req.query("before");
  const after = c.req.query("after");

  const where = before
    ? lt(schema.checkIn.ordinal, BigInt(before))
    : after
      ? gt(schema.checkIn.ordinal, BigInt(after))
      : undefined;

  const rows = await db
    .select()
    .from(schema.checkIn)
    .where(where)
    .orderBy(desc(schema.checkIn.ordinal))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(toFeedItem);

  return c.json({
    items,
    // Pass back as ?before= to fetch the next (older) page.
    nextCursor: hasMore ? (items.at(-1)?.cursor ?? null) : null,
    // Pass back as ?after= to poll for check-ins newer than this page.
    latestCursor: items[0]?.cursor ?? null,
  });
});

/**
 * Screen 2 — a member's profile: current streak, all-time total, recent notes.
 *
 * The stored streak is the value the contract emitted at their last check-in;
 * `liveStreak` decays it, because a streak breaking is the absence of an event
 * and nothing onchain ever records it.
 */
app.get("/members/:address", async (c) => {
  const raw = c.req.param("address");
  if (!isAddress(raw)) return c.json({ error: "invalid address" }, 400);
  const address = getAddress(raw);
  const asOf = today();

  const [row] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.address, address))
    .limit(1);

  if (!row) {
    return c.json({
      address,
      exists: false,
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      checkedInToday: false,
      recent: [],
    });
  }

  const limit = parseLimit(c.req.query("limit"), 30);
  const recent = await db
    .select()
    .from(schema.checkIn)
    .where(eq(schema.checkIn.member, address))
    .orderBy(desc(schema.checkIn.ordinal))
    .limit(limit);

  const [thisMonth] = await db
    .select()
    .from(schema.memberMonth)
    .where(
      and(
        eq(schema.memberMonth.member, address),
        eq(schema.memberMonth.month, currentMonth()),
      ),
    )
    .limit(1);

  return c.json({
    address,
    exists: true,
    currentStreak: liveStreak(row.lastDay, row.currentStreak, asOf),
    longestStreak: row.longestStreak,
    totalCheckIns: row.totalCheckIns,
    checkInsThisMonth: thisMonth?.checkIns ?? 0,
    checkedInToday: row.lastDay === asOf,
    // True until midnight: they checked in yesterday, so the streak is still alive.
    streakAtRisk: row.lastDay === asOf - 1,
    joinedDate: dateOf(row.firstDay),
    joinedAt: new Date(row.firstCheckInAt * 1000).toISOString(),
    lastCheckInDate: dateOf(row.lastDay),
    lastNote: row.lastNote,
    recent: recent.map(toFeedItem),
  });
});

/**
 * Screen 3 — this month's leaderboard by check-in count.
 *
 * Reads the per-member-per-month counters the indexer maintains, so this is one
 * indexed range scan over the month regardless of how many months of history
 * sit behind it. `?month=YYYY-MM` reads any past month just as cheaply.
 */
app.get("/leaderboard", async (c) => {
  const month = c.req.query("month") ?? currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: "month must be YYYY-MM" }, 400);
  }
  const limit = parseLimit(c.req.query("limit"), 25);
  const asOf = today();

  const rows = await db
    .select()
    .from(schema.memberMonth)
    .where(eq(schema.memberMonth.month, month))
    .orderBy(desc(schema.memberMonth.checkIns), desc(schema.memberMonth.bestStreak))
    .limit(limit);

  // One extra lookup per listed member to show their live streak next to the
  // count; bounded by `limit`, so at most 100 keyed reads.
  const entries = await Promise.all(
    rows.map(async (row, i) => {
      const [m] = await db
        .select()
        .from(schema.member)
        .where(eq(schema.member.address, row.member))
        .limit(1);
      return {
        rank: i + 1,
        member: getAddress(row.member),
        checkIns: row.checkIns,
        bestStreakThisMonth: row.bestStreak,
        currentStreak: m ? liveStreak(m.lastDay, m.currentStreak, asOf) : 0,
        totalCheckIns: m?.totalCheckIns ?? 0,
        lastCheckInAt: new Date(row.lastCheckInAt * 1000).toISOString(),
      };
    }),
  );

  return c.json({ month, isCurrentMonth: month === currentMonth(), entries });
});

/** Community totals and the last 30 days of activity, for a header or chart. */
app.get("/stats", async (c) => {
  const [g] = await db
    .select()
    .from(schema.globalStat)
    .where(eq(schema.globalStat.id, "streak"))
    .limit(1);

  const asOf = today();
  const days = await db
    .select()
    .from(schema.dayStat)
    .where(gt(schema.dayStat.day, asOf - 30))
    .orderBy(desc(schema.dayStat.day));

  return c.json({
    totalCheckIns: g?.totalCheckIns ?? 0,
    totalMembers: g?.totalMembers ?? 0,
    firstDate: g ? dateOf(g.firstDay) : null,
    today: dateOf(asOf),
    currentMonth: currentMonth(),
    activity: days.map((d) => ({
      date: dateOf(d.day),
      checkIns: d.checkIns,
      newMembers: d.newMembers,
    })),
  });
});

/**
 * Liveness + backfill progress.
 *
 * `behindSeconds` is how far the newest indexed check-in lags wall clock — the
 * number to alert on. Ponder reserves /ready, /health, /status and /metrics for
 * its own sync state, so this sits alongside them as the app-level view.
 */
app.get("/freshness", async (c) => {
  const [latest] = await db
    .select()
    .from(schema.checkIn)
    .orderBy(desc(schema.checkIn.ordinal))
    .limit(1);

  const now = Math.floor(Date.now() / 1000);
  return c.json({
    latestCheckInAt: latest ? new Date(latest.timestamp * 1000).toISOString() : null,
    latestBlock: latest?.blockNumber.toString() ?? null,
    behindSeconds: latest ? now - latest.timestamp : null,
    today: dateOf(today()),
    dayStartsAt: new Date(dayStart(today()) * 1000).toISOString(),
    month: monthOf(today()),
  });
});

export default app;
