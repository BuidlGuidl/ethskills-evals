import { db } from "ponder:api";
import { checkIns, members, monthlyMemberCheckIns } from "ponder:schema";
import { desc, eq } from "ponder";
import { Hono } from "hono";
import { getAddress, isAddress } from "viem";
import { activeCurrentStreak, currentUtcDay, currentUtcMonth } from "../dates";

const app = new Hono();

function limitParam(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function normalizeAddress(address: string): `0x${string}` | null {
  if (!isAddress(address)) return null;
  return getAddress(address).toLowerCase() as `0x${string}`;
}

function validMonth(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}

app.get("/api/feed", async (c) => {
  const limit = limitParam(c.req.query("limit"), 50, 100);
  const rows = await db
    .select()
    .from(checkIns)
    .orderBy(desc(checkIns.timestamp), desc(checkIns.logIndex))
    .limit(limit);

  return c.json({
    items: rows.map((row) => ({
      id: row.id,
      member: row.member,
      timestamp: row.timestamp,
      day: row.day,
      month: row.month,
      note: row.note,
      transactionHash: row.transactionHash,
      blockNumber: row.blockNumber.toString(),
      logIndex: row.logIndex,
    })),
  });
});

app.get("/api/members/:address", async (c) => {
  const address = normalizeAddress(c.req.param("address"));
  if (address === null) {
    return c.json({ error: "Invalid member address" }, 400);
  }

  const rows = await db.select().from(members).where(eq(members.address, address)).limit(1);
  const member = rows[0];

  if (member === undefined) {
    return c.json({ error: "Member has not checked in" }, 404);
  }

  return c.json({
    address: member.address,
    currentStreak: activeCurrentStreak(
      member.currentStreak,
      member.lastCheckInDay,
      currentUtcDay(),
    ),
    streakThroughLastCheckIn: member.currentStreak,
    totalCheckIns: member.totalCheckIns,
    lastCheckInDay: member.lastCheckInDay,
    lastCheckInAt: member.lastCheckInAt,
  });
});

app.get("/api/leaderboard/monthly", async (c) => {
  const month = c.req.query("month") ?? currentUtcMonth();
  if (!validMonth(month)) {
    return c.json({ error: "Month must be YYYY-MM" }, 400);
  }

  const limit = limitParam(c.req.query("limit"), 50, 100);
  const rows = await db
    .select()
    .from(monthlyMemberCheckIns)
    .where(eq(monthlyMemberCheckIns.month, month))
    .orderBy(desc(monthlyMemberCheckIns.checkIns), desc(monthlyMemberCheckIns.lastCheckInAt))
    .limit(limit);

  return c.json({
    month,
    items: rows.map((row, index) => ({
      rank: index + 1,
      member: row.member,
      checkIns: row.checkIns,
      lastCheckInAt: row.lastCheckInAt,
    })),
  });
});

export default app;
