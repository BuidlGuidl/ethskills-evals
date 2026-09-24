import { db } from "ponder:api";
import { checkIns, memberMonths, members } from "ponder:schema";
import { desc, eq } from "ponder";
import { Hono } from "hono";

import { currentMonthKey, currentUtcDay, effectiveCurrentStreak, isMonthKey } from "../date";

const app = new Hono();

app.get("/feed", async (c) => {
  const limit = clampLimit(c.req.query("limit"), 25, 100);

  const rows = await db
    .select()
    .from(checkIns)
    .orderBy(desc(checkIns.blockNumber), desc(checkIns.logIndex))
    .limit(limit);

  return c.json({
    items: rows.map((row) => ({
      id: row.id,
      checkInId: row.checkInId.toString(),
      member: row.member,
      day: row.day,
      note: row.note,
      timestamp: row.timestamp.toString(),
      blockNumber: row.blockNumber.toString(),
      transactionHash: row.transactionHash,
      logIndex: row.logIndex,
    })),
  });
});

app.get("/members/:address", async (c) => {
  const address = normalizeAddress(c.req.param("address"));
  if (address == null) {
    return c.json({ error: "Invalid address" }, 400);
  }

  const [row] = await db.select().from(members).where(eq(members.address, address)).limit(1);
  if (row == null) {
    return c.json({
      address,
      totalCheckIns: 0,
      currentStreak: 0,
      streakAtLastCheckIn: 0,
      lastCheckInDay: null,
      lastCheckInAt: null,
    });
  }

  return c.json({
    address: row.address,
    totalCheckIns: row.totalCheckIns,
    currentStreak: effectiveCurrentStreak(
      row.streakAtLastCheckIn,
      row.lastCheckInDay,
      currentUtcDay(),
    ),
    streakAtLastCheckIn: row.streakAtLastCheckIn,
    lastCheckInDay: row.lastCheckInDay,
    lastCheckInAt: row.lastCheckInAt.toString(),
  });
});

app.get("/leaderboard/monthly", async (c) => {
  const requestedMonth = c.req.query("month") ?? currentMonthKey();
  if (!isMonthKey(requestedMonth)) {
    return c.json({ error: "Invalid month. Expected YYYY-MM." }, 400);
  }

  const limit = clampLimit(c.req.query("limit"), 50, 100);
  const rows = await db
    .select()
    .from(memberMonths)
    .where(eq(memberMonths.month, requestedMonth))
    .orderBy(desc(memberMonths.checkIns), desc(memberMonths.lastCheckInAt))
    .limit(limit);

  return c.json({
    month: requestedMonth,
    items: rows.map((row, index) => ({
      rank: index + 1,
      member: row.member,
      checkIns: row.checkIns,
      lastCheckInAt: row.lastCheckInAt.toString(),
    })),
  });
});

function clampLimit(raw: string | undefined, fallback: number, max: number): number {
  const parsed = raw == null ? fallback : Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function normalizeAddress(value: string): `0x${string}` | null {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return null;
  }

  return value.toLowerCase() as `0x${string}`;
}

export default app;
