import type { StreakDatabase } from "./database.js";
import { monthFromTimestamp } from "./database.js";

export type CheckIn = {
  id: string;
  member: string;
  day: number;
  note: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
};

export function applyCheckIn(db: StreakDatabase, checkIn: CheckIn) {
  const member = checkIn.member.toLowerCase();
  const inserted = db.prepare(`
    INSERT OR IGNORE INTO check_ins
      (id, member, day, note, timestamp, block_number, transaction_hash, log_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(checkIn.id, member, checkIn.day, checkIn.note, checkIn.timestamp,
    checkIn.blockNumber, checkIn.transactionHash, checkIn.logIndex);
  if (inserted.changes === 0) return;

  const previous = db.prepare("SELECT last_day FROM members WHERE address = ?")
    .get(member) as { last_day: number } | undefined;
  const streak = previous?.last_day === checkIn.day - 1
    ? (db.prepare("SELECT current_streak FROM members WHERE address = ?").get(member) as { current_streak: number }).current_streak + 1
    : 1;

  db.prepare(`
    INSERT INTO members(address, total, current_streak, last_day, last_timestamp)
    VALUES (?, 1, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      total = total + 1, current_streak = excluded.current_streak,
      last_day = excluded.last_day, last_timestamp = excluded.last_timestamp
  `).run(member, streak, checkIn.day, checkIn.timestamp);

  db.prepare(`
    INSERT INTO monthly_counts(month, member, count) VALUES (?, ?, 1)
    ON CONFLICT(month, member) DO UPDATE SET count = count + 1
  `).run(monthFromTimestamp(checkIn.timestamp), member);
}
