import type Database from "better-sqlite3";
import type { CheckIn } from "./database.js";

const DAY_SECONDS = 86_400;
const utcDay = (timestamp: number) => Math.floor(timestamp / DAY_SECONDS);
const monthStartDay = (now = new Date()) => Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000 / DAY_SECONDS);

export const recentFeed = (db: Database.Database, limit: number, before?: number): CheckIn[] => {
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  return before === undefined
    ? db.prepare("SELECT * FROM checkins ORDER BY timestamp DESC, id DESC LIMIT ?").all(boundedLimit) as CheckIn[]
    : db.prepare("SELECT * FROM checkins WHERE id < ? ORDER BY timestamp DESC, id DESC LIMIT ?").all(before, boundedLimit) as CheckIn[];
};

export const memberProfile = (db: Database.Database, account: string) => {
  const rows = db.prepare("SELECT day FROM checkins WHERE account = ? ORDER BY day DESC").all(account.toLowerCase()) as { day: number }[];
  let currentStreak = 0;
  let expected = utcDay(Date.now() / 1000);
  // A member who checked in yesterday still has an active streak today.
  if (rows[0]?.day === expected - 1) expected -= 1;
  for (const row of rows) {
    if (row.day !== expected) break;
    currentStreak += 1;
    expected -= 1;
  }
  return { account: account.toLowerCase(), currentStreak, totalCheckIns: rows.length };
};

export const monthlyLeaderboard = (db: Database.Database, limit: number) => db.prepare(`
  SELECT account, COUNT(*) AS checkIns
  FROM checkins
  WHERE day >= ?
  GROUP BY account
  ORDER BY checkIns DESC, account ASC
  LIMIT ?
`).all(monthStartDay(), Math.min(Math.max(limit, 1), 100));

