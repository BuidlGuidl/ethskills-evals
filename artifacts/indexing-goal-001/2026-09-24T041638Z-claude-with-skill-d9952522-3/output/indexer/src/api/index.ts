import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, asc, desc, eq, graphql, lt } from "ponder";
import { db } from "ponder:api";
import schema, { checkIn, member, memberMonth, stats } from "ponder:schema";
import { getAddress, isAddress } from "viem";
import { currentDayIndex, currentMonthKey, liveStreak } from "../util/time";

const app = new Hono();

app.use("*", cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "*" }));

// Auto-generated GraphQL over the whole schema, handy for ad-hoc queries.
// The REST routes below are what the three screens actually call.
app.use("/graphql", graphql({ db, schema }));

const MAX_LIMIT = 100;

function readLimit(raw: string | undefined, fallback: number): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), MAX_LIMIT);
}

function serializeCheckIn(row: typeof checkIn.$inferSelect) {
  return {
    id: row.seq.toString(),
    member: getAddress(row.member),
    note: row.note,
    streak: row.streak,
    memberTotal: row.memberTotal,
    day: row.day,
    month: row.month,
    timestamp: row.timestamp,
    checkedInAt: new Date(row.timestamp * 1000).toISOString(),
    blockNumber: row.blockNumber.toString(),
    txHash: row.txHash,
  };
}

/**
 * Screen 1 — global feed, newest first, across everyone and all of history.
 *
 * GET /feed?limit=50&cursor=<nextCursor>&member=0x...
 *
 * Keyset pagination on `seq` (blockNumber*1e6+logIndex): stable and O(limit)
 * however deep the history goes, unlike OFFSET.
 */
app.get("/feed", async (c) => {
  const limit = readLimit(c.req.query("limit"), 50);
  const cursorRaw = c.req.query("cursor");
  const memberRaw = c.req.query("member");

  let cursor: bigint | undefined;
  if (cursorRaw !== undefined) {
    try {
      cursor = BigInt(cursorRaw);
    } catch {
      return c.json({ error: "cursor must be an integer string from a previous nextCursor" }, 400);
    }
  }

  // strict: false — accept lowercase addresses, not just EIP-55 checksummed ones.
  if (memberRaw !== undefined && !isAddress(memberRaw, { strict: false })) {
    return c.json({ error: "member must be an address" }, 400);
  }

  const filters = [
    cursor === undefined ? undefined : lt(checkIn.seq, cursor),
    memberRaw === undefined ? undefined : eq(checkIn.member, memberRaw.toLowerCase() as `0x${string}`),
  ].filter((f) => f !== undefined);

  const rows = await db
    .select()
    .from(checkIn)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(checkIn.seq))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return c.json({
    items: page.map(serializeCheckIn),
    // null means the caller has reached the contract's first day.
    nextCursor: rows.length > limit && page.length > 0 ? page[page.length - 1]!.seq.toString() : null,
  });
});

/**
 * Screen 2 — member profile: current streak + all-time total, plus their history.
 *
 * GET /members/:address?limit=20
 *
 * `currentStreak` here is derived from indexed state against today's UTC date,
 * because a streak breaks with the passage of time and emits no event when it
 * does. The contract's `profileOf` view is the authoritative live answer — see
 * client/src/profile.ts; this route exists so the screen can render streak,
 * total and recent notes in one request.
 */
app.get("/members/:address", async (c) => {
  const address = c.req.param("address");
  if (!isAddress(address, { strict: false })) return c.json({ error: "invalid address" }, 400);
  const key = address.toLowerCase() as `0x${string}`;
  const limit = readLimit(c.req.query("limit"), 20);

  const [row] = await db.select().from(member).where(eq(member.address, key)).limit(1);

  if (row === undefined) {
    return c.json({
      member: getAddress(address),
      currentStreak: 0,
      longestStreak: 0,
      total: 0,
      checkedInToday: false,
      firstCheckInAt: null,
      lastCheckInAt: null,
      thisMonth: 0,
      recentCheckIns: [],
    });
  }

  const today = currentDayIndex();
  const month = currentMonthKey();

  const [monthRow] = await db
    .select()
    .from(memberMonth)
    .where(and(eq(memberMonth.member, key), eq(memberMonth.month, month)))
    .limit(1);

  const recent = await db
    .select()
    .from(checkIn)
    .where(eq(checkIn.member, key))
    .orderBy(desc(checkIn.seq))
    .limit(limit);

  return c.json({
    member: getAddress(row.address),
    currentStreak: liveStreak(row.streakAtLastDay, row.lastDay, today),
    longestStreak: row.longestStreak,
    total: row.total,
    checkedInToday: row.lastDay === today,
    firstCheckInAt: new Date(row.firstCheckInAt * 1000).toISOString(),
    lastCheckInAt: new Date(row.lastCheckInAt * 1000).toISOString(),
    lastNote: row.lastNote,
    thisMonth: monthRow?.checkIns ?? 0,
    recentCheckIns: recent.map(serializeCheckIn),
  });
});

/**
 * Screen 3 — leaderboard: top members by check-ins in a calendar month (UTC).
 *
 * GET /leaderboard?month=YYYY-MM&limit=25   (month defaults to the current one)
 *
 * Reads the pre-aggregated member_month table, so this is one indexed lookup
 * regardless of how many months of history exist. Ties break toward whoever got
 * to that count first.
 */
app.get("/leaderboard", async (c) => {
  const month = c.req.query("month") ?? currentMonthKey();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return c.json({ error: "month must be YYYY-MM" }, 400);
  }
  const limit = readLimit(c.req.query("limit"), 25);

  const rows = await db
    .select({
      member: memberMonth.member,
      checkIns: memberMonth.checkIns,
      lastCheckInAt: memberMonth.lastCheckInAt,
      longestStreakInMonth: memberMonth.longestStreakInMonth,
      allTimeTotal: member.total,
      streakAtLastDay: member.streakAtLastDay,
      lastDay: member.lastDay,
    })
    .from(memberMonth)
    .innerJoin(member, eq(memberMonth.member, member.address))
    .where(eq(memberMonth.month, month))
    .orderBy(desc(memberMonth.checkIns), asc(memberMonth.lastCheckInAt))
    .limit(limit);

  const today = currentDayIndex();

  return c.json({
    month,
    items: rows.map((row, i) => ({
      rank: i + 1,
      member: getAddress(row.member),
      checkIns: row.checkIns,
      longestStreakInMonth: row.longestStreakInMonth,
      currentStreak: liveStreak(row.streakAtLastDay, row.lastDay, today),
      allTimeTotal: row.allTimeTotal,
      lastCheckInAt: new Date(row.lastCheckInAt * 1000).toISOString(),
    })),
  });
});

/// Community header numbers.
app.get("/stats", async (c) => {
  const [row] = await db.select().from(stats).where(eq(stats.id, "global")).limit(1);
  return c.json({
    totalCheckIns: row?.totalCheckIns ?? 0,
    totalMembers: row?.totalMembers ?? 0,
    lastCheckInAt: row?.lastCheckInAt ? new Date(row.lastCheckInAt * 1000).toISOString() : null,
    currentMonth: currentMonthKey(),
  });
});

export default app;
