import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { asc, count, desc, eq } from "ponder";

import { currentDay, currentMonth, formatMonth, liveStreak, parseMonth } from "../lib/time";
import { clampLimit } from "./shared";

const app = new Hono();

/**
 * GET /api/leaderboard
 *
 *   ?month=YYYY-MM       default: the current UTC month
 *   ?limit=25            page size (max 100)
 *   ?offset=0            for "show more"
 *
 * Ranked by check-ins in that month, ties broken by who got there first. Reads
 * one indexed slice of `member_month`, which the indexer keeps up to date for
 * every month the contract has ever seen — past months stay queryable forever.
 */
app.get("/leaderboard", async (c) => {
  const monthParam = c.req.query("month");
  if (monthParam !== undefined && parseMonth(monthParam) === null) {
    return c.json({ error: "invalid month, expected YYYY-MM" }, 400);
  }
  const month = parseMonth(monthParam) ?? currentMonth();
  const limit = clampLimit(c.req.query("limit"), 25, 100);
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
  const today = currentDay();

  const rows = await db
    .select({
      member: schema.memberMonth.member,
      checkIns: schema.memberMonth.checkIns,
      bestStreakInMonth: schema.memberMonth.bestStreakInMonth,
      firstCheckInAt: schema.memberMonth.firstCheckInAt,
      lastCheckInAt: schema.memberMonth.lastCheckInAt,
      streakAsOfLastDay: schema.member.streakAsOfLastDay,
      lastDay: schema.member.lastDay,
      longestStreak: schema.member.longestStreak,
      totalCheckIns: schema.member.totalCheckIns,
    })
    .from(schema.memberMonth)
    .innerJoin(schema.member, eq(schema.member.address, schema.memberMonth.member))
    .where(eq(schema.memberMonth.month, month))
    .orderBy(
      desc(schema.memberMonth.checkIns),
      asc(schema.memberMonth.firstCheckInAt),
      asc(schema.memberMonth.member),
    )
    .limit(limit)
    .offset(offset);

  const [total] = await db
    .select({ n: count() })
    .from(schema.memberMonth)
    .where(eq(schema.memberMonth.month, month));

  return c.json({
    month: formatMonth(month),
    totalMembers: total?.n ?? 0,
    entries: rows.map((r, i) => ({
      rank: offset + i + 1,
      member: r.member,
      checkIns: r.checkIns,
      bestStreakInMonth: r.bestStreakInMonth,
      // All-time context, so the leaderboard row can show more than a count.
      currentStreak: liveStreak(r.streakAsOfLastDay, r.lastDay, today),
      longestStreak: r.longestStreak,
      totalCheckIns: r.totalCheckIns,
      lastCheckInAt: Number(r.lastCheckInAt),
    })),
  });
});

/**
 * GET /api/leaderboard/months
 *
 * Every month that has at least one check-in, newest first — the month picker.
 */
app.get("/leaderboard/months", async (c) => {
  const rows = await db
    .selectDistinct({ month: schema.memberMonth.month })
    .from(schema.memberMonth)
    .orderBy(desc(schema.memberMonth.month));

  return c.json({ months: rows.map((r) => formatMonth(r.month)) });
});

export default app;
