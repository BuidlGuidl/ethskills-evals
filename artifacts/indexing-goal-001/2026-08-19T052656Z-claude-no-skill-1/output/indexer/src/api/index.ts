import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, asc, count, desc, eq, graphql, lt, or } from "ponder";
import { Hono } from "hono";
import { getAddress, isAddress } from "viem";
import {
  currentDay,
  currentMonth,
  isMonthKey,
  liveStreak,
} from "../../utils/time";

const app = new Hono();

/**
 * The read side of Streak. Three screens, three endpoints:
 *
 *   GET /feed                     -> global feed, newest first
 *   GET /members/:address         -> profile: live streak + all-time total
 *   GET /leaderboard              -> top members this month
 *
 * Every one of them is served from the indexed tables, so they cover the contract's
 * full history from its first day and answer in a single indexed query regardless of
 * how many months of check-ins are behind them.
 */

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function parseLimit(raw: string | undefined): number {
  const value = Number(raw ?? DEFAULT_LIMIT);
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT);
}

/**
 * Feed pages use keyset pagination on (blockNumber, logIndex) rather than OFFSET:
 * the cursor is a position in the log, so pages stay stable and cheap even as new
 * check-ins land at the head while somebody is scrolling.
 */
type Cursor = { blockNumber: bigint; logIndex: number };

function parseCursor(raw: string | undefined): Cursor | undefined | null {
  if (raw === undefined || raw === "") return undefined;
  const match = /^(\d+)-(\d+)$/.exec(raw);
  if (match === null) return null; // malformed -> 400
  return { blockNumber: BigInt(match[1]!), logIndex: Number(match[2]!) };
}

function cursorOf(row: { blockNumber: bigint; logIndex: number }): string {
  return `${row.blockNumber}-${row.logIndex}`;
}

/**
 * Accepts an address in any casing — a UI passing the lowercase form it got back
 * from us should not get a 400 — and normalises it to the checksummed form used
 * everywhere in responses. Returns null if it is not an address at all.
 */
function parseAddress(raw: string): `0x${string}` | null {
  if (!isAddress(raw, { strict: false })) return null;
  return getAddress(raw.toLowerCase());
}

function serializeCheckIn(row: typeof schema.checkIn.$inferSelect) {
  return {
    id: row.id,
    member: getAddress(row.member),
    note: row.note,
    timestamp: row.timestamp,
    time: new Date(row.timestamp * 1000).toISOString(),
    day: row.day,
    streak: row.streak,
    blockNumber: row.blockNumber.toString(),
    transactionHash: row.transactionHash,
  };
}

/** Reads a page of check-ins newest-first, optionally scoped to one member. */
async function readFeed(options: {
  limit: number;
  cursor?: Cursor;
  member?: `0x${string}`;
}) {
  const { limit, cursor, member } = options;

  const filters = [];
  if (member !== undefined) filters.push(eq(schema.checkIn.member, member));
  if (cursor !== undefined) {
    filters.push(
      or(
        lt(schema.checkIn.blockNumber, cursor.blockNumber),
        and(
          eq(schema.checkIn.blockNumber, cursor.blockNumber),
          lt(schema.checkIn.logIndex, cursor.logIndex),
        ),
      ),
    );
  }

  // Fetch one extra row to decide whether another page exists.
  const rows = await db
    .select()
    .from(schema.checkIn)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.checkIn.blockNumber), desc(schema.checkIn.logIndex))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];

  return {
    items: page.map(serializeCheckIn),
    nextCursor: rows.length > limit && last !== undefined ? cursorOf(last) : null,
  };
}

// ---------------------------------------------------------------------------
// Screen 1 — the global feed.
// ---------------------------------------------------------------------------

app.get("/feed", async (c) => {
  const cursor = parseCursor(c.req.query("cursor"));
  if (cursor === null) {
    return c.json({ error: "cursor must look like <blockNumber>-<logIndex>" }, 400);
  }

  const page = await readFeed({ limit: parseLimit(c.req.query("limit")), cursor });
  return c.json(page);
});

// ---------------------------------------------------------------------------
// Screen 2 — a member's profile.
// ---------------------------------------------------------------------------

app.get("/members/:address", async (c) => {
  const address = parseAddress(c.req.param("address"));
  if (address === null) return c.json({ error: "invalid address" }, 400);

  const [record] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.address, address))
    .limit(1);

  // An address with no check-ins is a valid, empty profile rather than a 404 —
  // the profile screen renders it as "0 check-ins".
  if (record === undefined) {
    return c.json({
      address,
      hasCheckedIn: false,
      currentStreak: 0,
      streakAsOfLastCheckIn: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      firstCheckInAt: null,
      lastCheckInAt: null,
      checkedInToday: false,
      streakAtRisk: false,
      recentCheckIns: [],
    });
  }

  const today = currentDay();
  const recent = await readFeed({ limit: 10, member: address });

  return c.json({
    address,
    hasCheckedIn: true,
    // Decayed against today: the stored streak is only true as of lastDay.
    currentStreak: liveStreak(record, today),
    streakAsOfLastCheckIn: record.streakAsOfLastCheckIn,
    longestStreak: record.longestStreak,
    totalCheckIns: record.totalCheckIns,
    firstCheckInAt: record.firstCheckInAt,
    lastCheckInAt: record.lastCheckInAt,
    checkedInToday: record.lastDay === today,
    // True while the streak is alive but today's check-in is still missing.
    streakAtRisk: record.lastDay === today - 1,
    recentCheckIns: recent.items,
  });
});

/** A member's own history, same paging contract as /feed. */
app.get("/members/:address/check-ins", async (c) => {
  const address = parseAddress(c.req.param("address"));
  if (address === null) return c.json({ error: "invalid address" }, 400);

  const cursor = parseCursor(c.req.query("cursor"));
  if (cursor === null) {
    return c.json({ error: "cursor must look like <blockNumber>-<logIndex>" }, 400);
  }

  const page = await readFeed({
    limit: parseLimit(c.req.query("limit")),
    cursor,
    member: address,
  });
  return c.json(page);
});

// ---------------------------------------------------------------------------
// Screen 3 — this month's leaderboard.
// ---------------------------------------------------------------------------

app.get("/leaderboard", async (c) => {
  const month = c.req.query("month") ?? currentMonth();
  if (!isMonthKey(month)) {
    return c.json({ error: "month must look like YYYY-MM" }, 400);
  }

  const limit = parseLimit(c.req.query("limit"));
  const offset = Math.max(Number(c.req.query("offset") ?? 0) || 0, 0);
  const today = currentDay();

  // One indexed range scan over (month, check_ins) plus a join for the profile
  // columns — the size of the whole check-in log never enters into it.
  const rows = await db
    .select({
      address: schema.memberMonth.member,
      checkIns: schema.memberMonth.checkIns,
      lastCheckInAt: schema.memberMonth.lastCheckInAt,
      lastDay: schema.member.lastDay,
      streakAsOfLastCheckIn: schema.member.streakAsOfLastCheckIn,
      longestStreak: schema.member.longestStreak,
      totalCheckIns: schema.member.totalCheckIns,
    })
    .from(schema.memberMonth)
    .innerJoin(
      schema.member,
      eq(schema.memberMonth.member, schema.member.address),
    )
    .where(eq(schema.memberMonth.month, month))
    // Ties go to whoever got there first.
    .orderBy(
      desc(schema.memberMonth.checkIns),
      asc(schema.memberMonth.lastCheckInAt),
    )
    .limit(limit)
    .offset(offset);

  return c.json({
    month,
    entries: rows.map((row, i) => ({
      rank: offset + i + 1,
      address: getAddress(row.address),
      checkIns: row.checkIns,
      currentStreak: liveStreak(row, today),
      longestStreak: row.longestStreak,
      totalCheckIns: row.totalCheckIns,
      lastCheckInAt: row.lastCheckInAt,
    })),
  });
});

// ---------------------------------------------------------------------------
// Extras.
// ---------------------------------------------------------------------------

/** Community-wide totals, handy for a header or a health check on the backfill. */
app.get("/stats", async (c) => {
  const [checkIns] = await db
    .select({ value: count() })
    .from(schema.checkIn);
  const [members] = await db.select({ value: count() }).from(schema.member);
  const [latest] = await db
    .select({ timestamp: schema.checkIn.timestamp })
    .from(schema.checkIn)
    .orderBy(desc(schema.checkIn.blockNumber), desc(schema.checkIn.logIndex))
    .limit(1);

  return c.json({
    totalCheckIns: checkIns?.value ?? 0,
    totalMembers: members?.value ?? 0,
    latestCheckInAt: latest?.timestamp ?? null,
    month: currentMonth(),
    day: currentDay(),
  });
});

/**
 * GraphQL over the same tables, for clients that would rather select their own
 * shape than use the endpoints above. Ponder also serves /health and /ready.
 */
app.use("/graphql", graphql({ db, schema }));

export default app;
