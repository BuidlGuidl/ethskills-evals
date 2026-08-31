import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { currentStreak, type CheckIn, utcMonthBounds } from "./domain.js";

export type FeedItem = Pick<CheckIn, "member" | "timestamp" | "note" | "transactionHash">;

export class StreakStore {
  readonly db: Database.Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS checkins (
        transaction_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        member TEXT NOT NULL,
        day INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        note TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        PRIMARY KEY (transaction_hash, log_index),
        UNIQUE (member, day)
      );
      CREATE INDEX IF NOT EXISTS checkins_recent ON checkins(block_number DESC, log_index DESC);
      CREATE INDEX IF NOT EXISTS checkins_member_day ON checkins(member, day DESC);
      CREATE INDEX IF NOT EXISTS checkins_day_member ON checkins(day, member);
      CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }

  getLastSyncedBlock(): number | undefined {
    const row = this.db.prepare("SELECT value FROM sync_state WHERE key = 'last_synced_block'").get() as { value: string } | undefined;
    return row ? Number(row.value) : undefined;
  }

  saveCheckIns(items: CheckIn[], lastSyncedBlock: number) {
    const insert = this.db.prepare(`INSERT OR IGNORE INTO checkins
      (transaction_hash, log_index, member, day, timestamp, note, block_number)
      VALUES (@transactionHash, @logIndex, @member, @day, @timestamp, @note, @blockNumber)`);
    const state = this.db.prepare(`INSERT INTO sync_state(key, value) VALUES ('last_synced_block', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
    this.db.transaction(() => {
      for (const item of items) insert.run({ ...item, member: item.member.toLowerCase() });
      state.run(String(lastSyncedBlock));
    })();
  }

  /** Removes an overlap before re-reading it, making periodic syncs safe around shallow reorgs. */
  rewind(fromBlock: number) {
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM checkins WHERE block_number >= ?").run(fromBlock);
      this.db.prepare(`INSERT INTO sync_state(key, value) VALUES ('last_synced_block', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(fromBlock - 1));
    })();
  }

  feed(limit: number, before?: { block: number; logIndex: number }): FeedItem[] {
    const cursor = before
      ? "WHERE (block_number < @block OR (block_number = @block AND log_index < @logIndex))"
      : "";
    return this.db.prepare(`SELECT member, timestamp, note, transaction_hash AS transactionHash
      FROM checkins ${cursor} ORDER BY block_number DESC, log_index DESC LIMIT @limit`).all({ limit, ...before }) as FeedItem[];
  }

  profile(member: string, nowSeconds: number) {
    const normalized = member.toLowerCase();
    const total = (this.db.prepare("SELECT count(*) AS count FROM checkins WHERE member = ?").get(normalized) as { count: number }).count;
    const days = this.db.prepare("SELECT day FROM checkins WHERE member = ? ORDER BY day DESC").all(normalized) as { day: number }[];
    return { member: normalized, currentStreak: currentStreak(days.map(({ day }) => day), nowSeconds), totalCheckIns: total };
  }

  leaderboard(nowSeconds: number, limit: number) {
    const { startDay, endDay } = utcMonthBounds(nowSeconds);
    return this.db.prepare(`SELECT member, count(*) AS checkIns
      FROM checkins WHERE day >= ? AND day < ? GROUP BY member
      ORDER BY checkIns DESC, member ASC LIMIT ?`).all(startDay, endDay, limit) as { member: string; checkIns: number }[];
  }
}
