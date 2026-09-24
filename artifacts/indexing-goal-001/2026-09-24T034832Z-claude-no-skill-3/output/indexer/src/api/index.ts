import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { and, asc, client, count, desc, eq, graphql, gt, inArray, lt, sum } from "ponder";
import { getAddress, isAddress } from "viem";
import { canCheckInToday, currentMonth, liveStreak, today } from "../lib/streak";

const app = new Hono();

/** Auto-generated GraphQL API over the schema above: POST/GET /graphql. */
app.use("/graphql", graphql({ db, schema }));

/** Direct SQL-over-HTTP for @ponder/client consumers: /sql/*. */
app.use("/sql/*", client({ db, schema }));

const MAX_LIMIT = 100;

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, MAX_LIMIT);
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function serializeCheckIn(row: typeof schema.checkIn.$inferSelect) {
  return {
    id: row.id,
    member: row.member,
    note: row.note,
    day: row.day,
    month: row.month,
    timestamp: Number(row.timestamp),
    isoTime: new Date(Number(row.timestamp) * 1000).toISOString(),
    streak: row.streak,
    total: row.total,
    blockNumber: Number(row.blockNumber),
    transactionHash: row.transactionHash,
    cursor: row.seq.toString(),
  };
}

/**
 * Screen 1 — global feed.
 *
 * GET /feed?limit=50&cursor=<cursor from the last item>
 * Newest first across every member, over the contract's entire history.
 * `cursor` is the `cursor` field of the last item you received; pass it back to
 * page further into the past. `nextCursor` is null on the last page.
 */
app.get("/feed", async (c) => {
  const limit = parseLimit(c.req.query("limit"), 50);
  const cursorRaw = c.req.query("cursor");

  let cursor: bigint | undefined;
  if (cursorRaw !== undefined) {
    try {
      cursor = BigInt(cursorRaw);
    } catch {
      return c.json({ error: `invalid cursor: ${cursorRaw}` }, 400);
    }
  }

  const rows = await db
    .select()
    .from(schema.checkIn)
    .where(cursor === undefined ? undefined : lt(schema.checkIn.seq, cursor))
    .orderBy(desc(schema.checkIn.seq))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return c.json({
    items: page.map(serializeCheckIn),
    nextCursor: rows.length > limit ? page[page.length - 1]!.seq.toString() : null,
  });
});

/**
 * Screen 2 — member profile.
 *
 * GET /members/:address?recent=10&month=YYYY-MM
 * Current streak (recomputed against today, since a streak dies silently),
 * all-time total, and the member's most recent notes.
 */
app.get("/members/:address", async (c) => {
  const raw = c.req.param("address");
  if (!isAddress(raw)) return c.json({ error: `invalid address: ${raw}` }, 400);
  const address = getAddress(raw);

  const month = c.req.query("month") ?? currentMonth();
  if (!MONTH_RE.test(month)) return c.json({ error: `invalid month: ${month} (expected YYYY-MM)` }, 400);
  const recentLimit = parseLimit(c.req.query("recent"), 10);
  const currentDay = today();

  const [row] = await db.select().from(schema.member).where(eq(schema.member.address, address)).limit(1);

  if (row === undefined) {
    // Not an error: an address that has never checked in is a valid, empty profile.
    return c.json({
      address,
      exists: false,
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      checkInsThisMonth: 0,
      canCheckInToday: true,
      firstCheckInAt: null,
      lastCheckInAt: null,
      recentCheckIns: [],
    });
  }

  const [monthRow] = await db
    .select()
    .from(schema.monthlyCount)
    .where(and(eq(schema.monthlyCount.member, address), eq(schema.monthlyCount.month, month)))
    .limit(1);

  const recent = await db
    .select()
    .from(schema.checkIn)
    .where(eq(schema.checkIn.member, address))
    .orderBy(desc(schema.checkIn.seq))
    .limit(recentLimit);

  return c.json({
    address,
    exists: true,
    currentStreak: liveStreak(row, currentDay),
    streakAtLastCheckIn: row.streakAtLastCheckIn,
    longestStreak: row.longestStreak,
    totalCheckIns: row.total,
    month,
    checkInsThisMonth: monthRow?.count ?? 0,
    canCheckInToday: canCheckInToday(row, currentDay),
    firstCheckInAt: Number(row.firstCheckInAt),
    lastCheckInAt: Number(row.lastCheckInAt),
    lastNote: row.lastNote,
    recentCheckIns: recent.map(serializeCheckIn),
  });
});

/**
 * Screen 3 — monthly leaderboard.
 *
 * GET /leaderboard?month=YYYY-MM&limit=25&offset=0
 * Top members by check-ins in that UTC month. Defaults to the current month.
 * Ties break in favour of whoever checked in first that month.
 */
app.get("/leaderboard", async (c) => {
  const month = c.req.query("month") ?? currentMonth();
  if (!MONTH_RE.test(month)) return c.json({ error: `invalid month: ${month} (expected YYYY-MM)` }, 400);

  const limit = parseLimit(c.req.query("limit"), 25);
  const offsetRaw = Number(c.req.query("offset") ?? 0);
  const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
  const currentDay = today();

  const rows = await db
    .select()
    .from(schema.monthlyCount)
    .where(eq(schema.monthlyCount.month, month))
    .orderBy(desc(schema.monthlyCount.count), asc(schema.monthlyCount.firstSeq))
    .limit(limit)
    .offset(offset);

  // One extra query instead of N: fetch the member aggregates for this page.
  const members =
    rows.length === 0
      ? []
      : await db
          .select()
          .from(schema.member)
          .where(inArray(schema.member.address, rows.map((r) => r.member)));
  const byAddress = new Map(members.map((m) => [m.address, m]));

  return c.json({
    month,
    entries: rows.map((row, i) => {
      const m = byAddress.get(row.member);
      return {
        rank: offset + i + 1,
        address: row.member,
        checkIns: row.count,
        currentStreak: m === undefined ? 0 : liveStreak(m, currentDay),
        longestStreak: m?.longestStreak ?? 0,
        totalCheckIns: m?.total ?? 0,
      };
    }),
  });
});

/** Community-wide totals, handy for a header or a sanity check against the contract. */
app.get("/stats", async (c) => {
  const month = c.req.query("month") ?? currentMonth();
  if (!MONTH_RE.test(month)) return c.json({ error: `invalid month: ${month} (expected YYYY-MM)` }, 400);
  const currentDay = today();

  const [totals] = await db.select({ checkIns: count() }).from(schema.checkIn);
  const [memberCount] = await db.select({ members: count() }).from(schema.member);
  const [monthTotals] = await db
    .select({ checkIns: sum(schema.monthlyCount.count), members: count() })
    .from(schema.monthlyCount)
    .where(eq(schema.monthlyCount.month, month));
  const [todayTotals] = await db
    .select()
    .from(schema.dailyTotal)
    .where(eq(schema.dailyTotal.day, currentDay))
    .limit(1);
  const [firstCheckIn] = await db
    .select()
    .from(schema.checkIn)
    .orderBy(asc(schema.checkIn.seq))
    .limit(1);
  const [activeStreaks] = await db
    .select({ members: count() })
    .from(schema.member)
    .where(gt(schema.member.lastDay, currentDay - 2));

  return c.json({
    totalCheckIns: Number(totals?.checkIns ?? 0),
    totalMembers: Number(memberCount?.members ?? 0),
    membersWithLiveStreak: Number(activeStreaks?.members ?? 0),
    month,
    checkInsThisMonth: Number(monthTotals?.checkIns ?? 0),
    activeMembersThisMonth: Number(monthTotals?.members ?? 0),
    checkInsToday: todayTotals?.checkIns ?? 0,
    firstEverCheckInAt: firstCheckIn === undefined ? null : Number(firstCheckIn.timestamp),
  });
});

export default app;
