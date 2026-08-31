import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { and, asc, client, desc, eq, graphql, lt } from "ponder";
import { isAddress } from "viem";

import {
  currentMonthKey,
  formatMonthKey,
  isStreakAtRisk,
  parseMonthKey,
  resolveCurrentStreak,
  today,
} from "../lib/time";

/**
 * The read side for the three screens. Everything here is a query against the
 * indexed tables — no RPC calls, no log scans at request time, so response time
 * does not grow as the contract's history does.
 *
 *   GET /feed?limit=50&cursor=<nextCursor>   global feed, newest first
 *   GET /members/:address?recent=10          profile: streak + all-time total
 *   GET /leaderboard?month=2026-08&limit=25  top members this month
 *
 * Ponder also serves an auto-generated GraphQL API over the same tables at
 * /graphql, and raw SQL over HTTP at /sql (see @ponder/client).
 */
const app = new Hono();

const MAX_LIMIT = 100;

function clampLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

type MemberRow = typeof schema.member.$inferSelect;

function memberView(row: MemberRow, todayIndex: number) {
  return {
    address: row.address,
    totalCheckIns: row.totalCheckIns,
    // Decayed at read time: a missed day emits no event, so the stored streak
    // is only ever "the streak as of lastDay".
    currentStreak: resolveCurrentStreak(row, todayIndex),
    longestStreak: row.longestStreak,
    checkedInToday: row.lastDay === todayIndex,
    streakAtRisk: isStreakAtRisk(row, todayIndex),
    firstCheckInAt: row.firstCheckInAt,
    lastCheckInAt: row.lastCheckInAt,
    lastNote: row.lastNote,
  };
}

/** Screen 1 — global feed of the most recent check-ins across everyone. */
app.get("/feed", async (c) => {
  const limit = clampLimit(c.req.query("limit"), 50);
  const cursor = c.req.query("cursor");
  const member = c.req.query("member");

  if (member !== undefined && !isAddress(member)) {
    return c.json({ error: "invalid member address" }, 400);
  }

  const filters = [
    // Keyset pagination: ids sort in chain order, so "older than the last row
    // I saw" is a single indexed comparison at any depth of history.
    cursor === undefined ? undefined : lt(schema.checkIn.id, cursor),
    member === undefined
      ? undefined
      : eq(schema.checkIn.member, member.toLowerCase() as `0x${string}`),
  ].filter((f) => f !== undefined);

  const rows = await db
    .select()
    .from(schema.checkIn)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.checkIn.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? items[items.length - 1]?.id : null;

  return c.json({
    items: items.map((row) => ({
      id: row.id,
      member: row.member,
      timestamp: row.timestamp,
      day: row.day,
      note: row.note,
      transactionHash: row.transactionHash,
      blockNumber: row.blockNumber.toString(),
    })),
    nextCursor: nextCursor ?? null,
  });
});

/** Screen 2 — a member's current streak, all-time total, recent check-ins. */
app.get("/members/:address", async (c) => {
  const address = c.req.param("address");
  if (!isAddress(address)) {
    return c.json({ error: "invalid member address" }, 400);
  }
  const normalized = address.toLowerCase() as `0x${string}`;
  const recent = clampLimit(c.req.query("recent"), 10);
  const todayIndex = today();

  const [row] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.address, normalized))
    .limit(1);

  if (row === undefined) {
    // Not an error: an address that has simply never checked in.
    return c.json({
      address: normalized,
      totalCheckIns: 0,
      currentStreak: 0,
      longestStreak: 0,
      checkedInToday: false,
      streakAtRisk: false,
      firstCheckInAt: null,
      lastCheckInAt: null,
      lastNote: null,
      recentCheckIns: [],
      monthlyCheckIns: 0,
    });
  }

  const [checkIns, [thisMonth]] = await Promise.all([
    db
      .select()
      .from(schema.checkIn)
      .where(eq(schema.checkIn.member, normalized))
      .orderBy(desc(schema.checkIn.id))
      .limit(recent),
    db
      .select()
      .from(schema.memberMonth)
      .where(
        and(
          eq(schema.memberMonth.member, normalized),
          eq(schema.memberMonth.month, currentMonthKey()),
        ),
      )
      .limit(1),
  ]);

  return c.json({
    ...memberView(row, todayIndex),
    monthlyCheckIns: thisMonth?.checkIns ?? 0,
    recentCheckIns: checkIns.map((checkIn) => ({
      id: checkIn.id,
      timestamp: checkIn.timestamp,
      day: checkIn.day,
      note: checkIn.note,
      transactionHash: checkIn.transactionHash,
    })),
  });
});

/** Screen 3 — top members by check-ins in a calendar month (default: this one). */
app.get("/leaderboard", async (c) => {
  const monthParam = c.req.query("month");
  const month =
    monthParam === undefined ? currentMonthKey() : parseMonthKey(monthParam);
  if (month === null) {
    return c.json({ error: "invalid month, expected YYYY-MM" }, 400);
  }

  const limit = clampLimit(c.req.query("limit"), 25);
  const todayIndex = today();

  const rows = await db
    .select({
      checkIns: schema.memberMonth.checkIns,
      lastCheckInAt: schema.memberMonth.lastCheckInAt,
      member: schema.member,
    })
    .from(schema.memberMonth)
    .innerJoin(
      schema.member,
      eq(schema.memberMonth.member, schema.member.address),
    )
    .where(eq(schema.memberMonth.month, month))
    .orderBy(
      desc(schema.memberMonth.checkIns),
      // Ties go to whoever got there first.
      asc(schema.memberMonth.lastCheckInAt),
    )
    .limit(limit);

  return c.json({
    month: formatMonthKey(month),
    entries: rows.map((row, i) => ({
      rank: i + 1,
      monthlyCheckIns: row.checkIns,
      ...memberView(row.member, todayIndex),
    })),
  });
});

app.get("/", (c) =>
  c.json({
    name: "streak-indexer",
    endpoints: {
      feed: "/feed?limit=50&cursor=<nextCursor>",
      profile: "/members/:address?recent=10",
      leaderboard: "/leaderboard?month=YYYY-MM&limit=25",
      graphql: "/graphql",
      sql: "/sql",
      health: "/health",
      ready: "/ready",
    },
  }),
);

app.use("/sql/*", client({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
