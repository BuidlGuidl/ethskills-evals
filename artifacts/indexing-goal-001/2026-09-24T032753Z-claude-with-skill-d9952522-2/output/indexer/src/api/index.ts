import { Hono } from "hono";
// Drizzle query operators are re-exported by `ponder` itself. Import them from
// here, not from `drizzle-orm` directly: Ponder pins its own copy of drizzle, and
// two copies in the tree produce structurally-incompatible column types.
import { and, desc, eq, graphql, lt } from "ponder";
import { db } from "ponder:api";
import schema from "ponder:schema";
import {
  currentDayIndex,
  isoDate,
  liveStreak,
  monthKey,
} from "../lib/streak";

/**
 * The read API. Three endpoints, one per screen, plus the auto-generated GraphQL
 * endpoint for anything else a client wants to ask.
 *
 * Every response is served from the indexed Postgres tables. No endpoint calls an
 * RPC node, scans logs, or aggregates over full history at request time.
 */
const app = new Hono();

/** Auto-generated GraphQL over the whole schema: GET/POST /graphql */
app.use("/graphql", graphql({ db, schema }));

const MAX_LIMIT = 100;

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function isAddress(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

/* ------------------------------------------------------------------ */
/* Screen 1: global feed                                              */
/* ------------------------------------------------------------------ */

/**
 * GET /feed?limit=50&cursor=<nextCursor>
 *
 * Newest check-ins across everyone. Keyset pagination on the ordered `id` column,
 * so page 100 costs the same as page 1 and rows can't shift under the client as new
 * check-ins arrive.
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

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return c.json({
    checkIns: page.map((r) => ({
      id: r.id,
      member: r.member,
      note: r.note,
      day: r.day,
      date: isoDate(r.day),
      timestamp: r.timestamp,
      streakAtCheckIn: r.streakAtCheckIn,
      totalAtCheckIn: r.totalAtCheckIn,
      transactionHash: r.transactionHash,
      blockNumber: r.blockNumber.toString(),
    })),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  });
});

/* ------------------------------------------------------------------ */
/* Screen 2: member profile                                           */
/* ------------------------------------------------------------------ */

/**
 * GET /members/:address?history=20
 *
 * Current streak and all-time total for one member, plus their latest check-ins.
 * The stored streak is the one recorded at their last check-in; `liveStreak`
 * applies the decay rule against today's date before it is returned.
 */
app.get("/members/:address", async (c) => {
  const raw = c.req.param("address");
  if (!isAddress(raw)) return c.json({ error: "invalid address" }, 400);
  const address = raw.toLowerCase() as `0x${string}`;
  const historyLimit = parseLimit(c.req.query("history"), 20);

  const [row] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.address, address))
    .limit(1);

  if (!row) {
    // Never checked in. A zeroed profile is more useful to the UI than a 404.
    return c.json({
      address,
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      checkedInToday: false,
      firstDate: null,
      lastDate: null,
      recentCheckIns: [],
    });
  }

  const today = currentDayIndex();
  const recent = await db
    .select()
    .from(schema.checkIn)
    .where(eq(schema.checkIn.member, address))
    .orderBy(desc(schema.checkIn.id))
    .limit(historyLimit);

  const thisMonth = await db
    .select()
    .from(schema.memberMonth)
    .where(
      and(
        eq(schema.memberMonth.member, address),
        eq(schema.memberMonth.month, monthKey(today)),
      ),
    )
    .limit(1);

  return c.json({
    address,
    currentStreak: liveStreak(row.streakAtLastDay, row.lastDay, today),
    longestStreak: row.longestStreak,
    totalCheckIns: row.totalCheckIns,
    checkedInToday: row.lastDay === today,
    checkInsThisMonth: thisMonth[0]?.checkIns ?? 0,
    firstDate: isoDate(row.firstDay),
    lastDate: isoDate(row.lastDay),
    lastNote: row.lastNote,
    recentCheckIns: recent.map((r) => ({
      id: r.id,
      date: isoDate(r.day),
      timestamp: r.timestamp,
      note: r.note,
      streakAtCheckIn: r.streakAtCheckIn,
      transactionHash: r.transactionHash,
    })),
  });
});

/* ------------------------------------------------------------------ */
/* Screen 3: monthly leaderboard                                      */
/* ------------------------------------------------------------------ */

/**
 * GET /leaderboard?month=YYYY-MM&limit=25
 *
 * Top members for a calendar month (UTC) by check-in count. Defaults to the current
 * month. Reads the precomputed `member_month` table, so cost does not grow as the
 * contract's history gets longer.
 */
app.get("/leaderboard", async (c) => {
  const limit = parseLimit(c.req.query("limit"), 25);
  const month = c.req.query("month") ?? monthKey(currentDayIndex());
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: "month must be formatted YYYY-MM" }, 400);
  }

  const rows = await db
    .select({
      member: schema.memberMonth.member,
      checkIns: schema.memberMonth.checkIns,
      bestStreakInMonth: schema.memberMonth.bestStreakInMonth,
      totalCheckIns: schema.member.totalCheckIns,
      streakAtLastDay: schema.member.streakAtLastDay,
      lastDay: schema.member.lastDay,
    })
    .from(schema.memberMonth)
    .innerJoin(schema.member, eq(schema.member.address, schema.memberMonth.member))
    .where(eq(schema.memberMonth.month, month))
    // Ties broken by the longest run inside the month, then by all-time total.
    .orderBy(
      desc(schema.memberMonth.checkIns),
      desc(schema.memberMonth.bestStreakInMonth),
      desc(schema.member.totalCheckIns),
    )
    .limit(limit);

  const today = currentDayIndex();

  return c.json({
    month,
    entries: rows.map((r, i) => ({
      rank: i + 1,
      member: r.member,
      checkIns: r.checkIns,
      bestStreakInMonth: r.bestStreakInMonth,
      currentStreak: liveStreak(r.streakAtLastDay, r.lastDay, today),
      totalCheckIns: r.totalCheckIns,
    })),
  });
});

/* ------------------------------------------------------------------ */
/* Community totals + health                                          */
/* ------------------------------------------------------------------ */

/** GET /stats — community-wide counters for headers and empty states. */
app.get("/stats", async (c) => {
  const [row] = await db
    .select()
    .from(schema.stats)
    .where(eq(schema.stats.id, "global"))
    .limit(1);

  return c.json({
    totalCheckIns: row?.totalCheckIns ?? 0,
    totalMembers: row?.totalMembers ?? 0,
    firstDate: row ? isoDate(row.firstDay) : null,
    lastDate: row ? isoDate(row.lastDay) : null,
    today: isoDate(currentDayIndex()),
  });
});

export default app;
