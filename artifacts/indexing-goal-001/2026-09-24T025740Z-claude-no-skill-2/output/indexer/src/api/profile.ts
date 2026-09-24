import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { and, asc, count, desc, eq, gt, gte, lte } from "ponder";

import {
  currentDay,
  currentMonth,
  formatMonth,
  liveStreak,
  monthDayRange,
  parseMonth,
  SECONDS_PER_DAY,
} from "../lib/time";
import { clampLimit, normalizeAddress, serializeCheckIn } from "./shared";

const app = new Hono();

/**
 * GET /api/members/:address
 *
 *   ?recent=10           how many recent check-ins to inline (max 100)
 *   ?month=YYYY-MM       month used for the "this month" block (default: now)
 *
 * Everything here comes from aggregates maintained during indexing, so the
 * response covers the member's whole history at O(1) reads — no event scan.
 */
app.get("/members/:address", async (c) => {
  const address = normalizeAddress(c.req.param("address"));
  if (address === null) return c.json({ error: "invalid address" }, 400);

  const recentLimit = clampLimit(c.req.query("recent"), 10, 100);
  const month = parseMonth(c.req.query("month")) ?? currentMonth();
  const today = currentDay();

  const [row] = await db.select().from(schema.member).where(eq(schema.member.address, address)).limit(1);

  if (row === undefined) {
    // Not an error: an address that has never checked in is a valid, empty profile.
    return c.json({
      address,
      exists: false,
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      checkedInToday: false,
      firstCheckIn: null,
      lastCheckIn: null,
      thisMonth: { month: formatMonth(month), checkIns: 0, rank: null },
      recentCheckIns: [],
    });
  }

  const [monthRow] = await db
    .select()
    .from(schema.memberMonth)
    .where(and(eq(schema.memberMonth.member, address), eq(schema.memberMonth.month, month)))
    .limit(1);

  // Rank within the month = how many members are ahead, plus one.
  let rank: number | null = null;
  if (monthRow !== undefined) {
    const [ahead] = await db
      .select({ n: count() })
      .from(schema.memberMonth)
      .where(and(eq(schema.memberMonth.month, month), gt(schema.memberMonth.checkIns, monthRow.checkIns)));
    rank = (ahead?.n ?? 0) + 1;
  }

  const recentCheckIns = await db
    .select()
    .from(schema.checkIn)
    .where(eq(schema.checkIn.member, address))
    .orderBy(desc(schema.checkIn.id))
    .limit(recentLimit);

  return c.json({
    address,
    exists: true,

    // The headline numbers for the profile screen.
    currentStreak: liveStreak(row.streakAsOfLastDay, row.lastDay, today),
    longestStreak: row.longestStreak,
    totalCheckIns: row.totalCheckIns,
    checkedInToday: row.lastDay === today,
    // True while the streak is alive but today's check-in is still missing.
    streakAtRisk: row.lastDay === today - 1,

    firstCheckIn: { day: row.firstDay, date: dayToDate(row.firstDay) },
    lastCheckIn: {
      day: row.lastDay,
      date: dayToDate(row.lastDay),
      timestamp: Number(row.lastCheckInAt),
      time: new Date(Number(row.lastCheckInAt) * 1000).toISOString(),
      note: row.lastNote,
    },

    thisMonth: {
      month: formatMonth(month),
      checkIns: monthRow?.checkIns ?? 0,
      bestStreak: monthRow?.bestStreakInMonth ?? 0,
      rank,
    },

    recentCheckIns: recentCheckIns.map(serializeCheckIn),
  });
});

/**
 * GET /api/members/:address/days?month=YYYY-MM
 *
 * The member's check-in days for one month, for an activity calendar.
 */
app.get("/members/:address/days", async (c) => {
  const address = normalizeAddress(c.req.param("address"));
  if (address === null) return c.json({ error: "invalid address" }, 400);

  const monthParam = c.req.query("month");
  if (monthParam !== undefined && parseMonth(monthParam) === null) {
    return c.json({ error: "invalid month, expected YYYY-MM" }, 400);
  }
  const month = parseMonth(monthParam) ?? currentMonth();
  const { firstDay, lastDay } = monthDayRange(month);

  const rows = await db
    .select()
    .from(schema.dayActivity)
    .where(
      and(
        eq(schema.dayActivity.member, address),
        gte(schema.dayActivity.day, firstDay),
        lte(schema.dayActivity.day, lastDay),
      ),
    )
    .orderBy(asc(schema.dayActivity.day));

  return c.json({
    address,
    month: formatMonth(month),
    days: rows.map((r) => ({
      day: r.day,
      date: dayToDate(r.day),
      timestamp: Number(r.timestamp),
      note: r.note,
    })),
  });
});

function dayToDate(day: number): string {
  return new Date(day * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10);
}

export default app;
