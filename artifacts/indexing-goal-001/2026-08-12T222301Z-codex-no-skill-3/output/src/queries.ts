import type { StreakDb } from "./db.js";

export function feed(db: StreakDb, limit = 50, beforeBlock?: number, beforeLog?: number) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  if (beforeBlock !== undefined && beforeLog !== undefined) {
    return db.prepare(`SELECT tx_hash txHash, log_index logIndex, member, day, note,
      block_number blockNumber, timestamp FROM check_ins
      WHERE block_number < ? OR (block_number = ? AND log_index < ?)
      ORDER BY block_number DESC, log_index DESC LIMIT ?`)
      .all(beforeBlock, beforeBlock, beforeLog, safeLimit);
  }
  return db.prepare(`SELECT tx_hash txHash, log_index logIndex, member, day, note,
    block_number blockNumber, timestamp FROM check_ins
    ORDER BY block_number DESC, log_index DESC LIMIT ?`).all(safeLimit);
}

export function memberProfile(db: StreakDb, address: string, today: number) {
  const member = address.toLowerCase();
  const days = (db.prepare("SELECT day FROM check_ins WHERE member=? ORDER BY day DESC")
    .all(member) as Array<{ day: number }>).map(row => row.day);
  let streak = 0;
  // A streak remains current through the day after the last check-in.
  if (days[0] === today || days[0] === today - 1) {
    let expected = days[0];
    for (const day of days) {
      if (day !== expected) break;
      streak++;
      expected--;
    }
  }
  return { member, currentStreak: streak, totalCheckIns: days.length, lastCheckInDay: days[0] ?? null };
}

export function monthlyLeaderboard(db: StreakDb, month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("month must be YYYY-MM");
  const start = Math.floor(Date.parse(`${month}-01T00:00:00Z`) / 86_400_000);
  if (!Number.isFinite(start)) throw new Error("invalid month");
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const end = Math.floor(date.getTime() / 86_400_000);
  return db.prepare(`SELECT member, COUNT(*) count FROM check_ins WHERE day >= ? AND day < ?
    GROUP BY member ORDER BY count DESC, member ASC LIMIT 100`).all(start, end);
}
