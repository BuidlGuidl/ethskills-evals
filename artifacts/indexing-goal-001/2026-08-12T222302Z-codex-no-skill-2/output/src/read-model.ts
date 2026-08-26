import type { DatabaseSync } from "node:sqlite";

type FeedCursor = { timestamp: number; blockNumber: number; logIndex: number; txHash: string };

function encodeCursor(cursor: FeedCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(raw: string): FeedCursor {
  const value: unknown = JSON.parse(Buffer.from(raw, "base64url").toString());
  if (!value || typeof value !== "object") throw new Error("invalid cursor");
  const cursor = value as Partial<FeedCursor>;
  if (typeof cursor.timestamp !== "number" || typeof cursor.blockNumber !== "number" || typeof cursor.logIndex !== "number" || typeof cursor.txHash !== "string") {
    throw new Error("invalid cursor");
  }
  return cursor as FeedCursor;
}

export class ReadModel {
  constructor(private readonly db: DatabaseSync) {}

  feed(limit: number, rawCursor?: string) {
    const cursor = rawCursor ? decodeCursor(rawCursor) : undefined;
    const where = cursor
      ? `WHERE (timestamp, block_number, log_index, tx_hash) < (?, ?, ?, ?)`
      : "";
    const args = cursor ? [cursor.timestamp, cursor.blockNumber, cursor.logIndex, cursor.txHash, limit + 1] : [limit + 1];
    const rows = this.db.prepare(`
      SELECT tx_hash AS txHash, log_index AS logIndex, block_number AS blockNumber,
             member, day, timestamp, note
      FROM check_ins ${where}
      ORDER BY timestamp DESC, block_number DESC, log_index DESC, tx_hash DESC
      LIMIT ?
    `).all(...args) as Array<FeedCursor & { member: string; day: number; note: string }>;
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return { items, nextCursor: hasMore && last ? encodeCursor(last) : null };
  }

  profile(member: string, nowSeconds = Math.floor(Date.now() / 1000)) {
    const normalized = member.toLowerCase();
    const totalRow = this.db.prepare("SELECT COUNT(*) AS total FROM check_ins WHERE member = ?").get(normalized) as { total: number };
    const days = this.db.prepare("SELECT day FROM check_ins WHERE member = ? ORDER BY day DESC").all(normalized) as Array<{ day: number }>;
    const today = Math.floor(nowSeconds / 86_400);
    let currentStreak = 0;
    if (days[0] && (days[0].day === today || days[0].day === today - 1)) {
      currentStreak = 1;
      for (let index = 1; index < days.length && days[index - 1]!.day - days[index]!.day === 1; index += 1) currentStreak += 1;
    }
    return { member: normalized, currentStreak, totalCheckIns: totalRow.total };
  }

  leaderboard(year: number, month: number, limit: number) {
    const startSeconds = Date.UTC(year, month - 1, 1) / 1000;
    const endSeconds = Date.UTC(year, month, 1) / 1000;
    const startDay = Math.floor(startSeconds / 86_400);
    const endDay = Math.floor(endSeconds / 86_400);
    const rows = this.db.prepare(`
      SELECT member, COUNT(*) AS checkIns
      FROM check_ins WHERE day >= ? AND day < ?
      GROUP BY member
      ORDER BY checkIns DESC, member ASC
      LIMIT ?
    `).all(startDay, endDay, limit) as Array<{ member: string; checkIns: number }>;
    const items = rows.map(row => ({ member: row.member, checkIns: row.checkIns }));
    return { year, month, items };
  }
}
