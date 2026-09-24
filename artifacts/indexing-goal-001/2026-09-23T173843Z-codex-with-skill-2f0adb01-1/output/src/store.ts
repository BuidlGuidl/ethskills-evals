import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { getAddress } from "viem";
import { deriveCurrentStreak, monthKeyFromTimestamp } from "./time.js";
import type {
  CheckInEvent,
  FeedCursor,
  FeedItem,
  LeaderboardEntry,
  MemberProfile,
} from "./types.js";

type MemberRow = {
  address: string;
  total_check_ins: number;
  first_day: number | null;
  last_day: number | null;
  streak_at_last_check_in: number;
  last_check_in_at: number | null;
};

type FeedRow = {
  id: string;
  member: string;
  note: string;
  day: number;
  timestamp: number;
  block_number: number;
  tx_hash: string;
  log_index: number;
};

type LeaderboardRow = {
  member: string;
  month: string;
  count: number;
  latest_timestamp: number;
};

export class StreakStore {
  readonly db: DatabaseSync;

  constructor(databasePath: string) {
    const directory = path.dirname(databasePath);
    if (directory !== ".") {
      fs.mkdirSync(directory, { recursive: true });
    }

    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  getLastIndexedBlock(): bigint | null {
    const row = this.db
      .prepare("SELECT value FROM meta WHERE key = 'last_indexed_block'")
      .get() as { value: string } | undefined;

    return row ? BigInt(row.value) : null;
  }

  setLastIndexedBlock(blockNumber: bigint): void {
    this.db
      .prepare(
        `INSERT INTO meta (key, value)
         VALUES ('last_indexed_block', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(blockNumber.toString());
  }

  ingestCheckIns(events: CheckInEvent[]): number {
    const sorted = [...events].sort(
      (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex,
    );

    this.db.exec("BEGIN IMMEDIATE");
    try {
      let inserted = 0;
      for (const event of sorted) {
        if (this.insertCheckIn(event)) {
          inserted += 1;
        }
      }
      this.db.exec("COMMIT");
      return inserted;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getFeed(limit: number, cursor?: FeedCursor): FeedItem[] {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const rows = cursor
      ? (this.db
          .prepare(
            `SELECT * FROM check_ins
             WHERE block_number < @blockNumber
                OR (block_number = @blockNumber AND log_index < @logIndex)
             ORDER BY block_number DESC, log_index DESC
             LIMIT @limit`,
          )
          .all({ ...cursor, limit: boundedLimit }) as FeedRow[])
      : (this.db
          .prepare(
            `SELECT * FROM check_ins
             ORDER BY block_number DESC, log_index DESC
             LIMIT ?`,
          )
          .all(boundedLimit) as FeedRow[]);

    return rows.map(rowToFeedItem);
  }

  getMemberProfile(
    address: `0x${string}`,
    nowTimestamp = Math.floor(Date.now() / 1000),
  ): MemberProfile {
    const normalized = getAddress(address);
    const row = this.db
      .prepare("SELECT * FROM members WHERE address = ?")
      .get(normalized.toLowerCase()) as MemberRow | undefined;

    if (!row) {
      return {
        address: normalized,
        totalCheckIns: 0,
        currentStreak: 0,
        firstCheckInDay: null,
        lastCheckInAt: null,
        lastCheckInDay: null,
        streakAtLastCheckIn: 0,
      };
    }

    return {
      address: normalized,
      totalCheckIns: row.total_check_ins,
      currentStreak: deriveCurrentStreak(
        row.streak_at_last_check_in,
        row.last_day,
        nowTimestamp,
      ),
      firstCheckInDay: row.first_day,
      lastCheckInAt: row.last_check_in_at,
      lastCheckInDay: row.last_day,
      streakAtLastCheckIn: row.streak_at_last_check_in,
    };
  }

  getMonthlyLeaderboard(month: string, limit: number): LeaderboardEntry[] {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const rows = this.db
      .prepare(
        `SELECT * FROM monthly_counts
         WHERE month = ?
         ORDER BY count DESC, latest_timestamp ASC, member ASC
         LIMIT ?`,
      )
      .all(month, boundedLimit) as LeaderboardRow[];

    return rows.map((row) => ({
      address: getAddress(row.member) as `0x${string}`,
      month: row.month,
      checkIns: row.count,
      latestCheckInAt: row.latest_timestamp,
    }));
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS check_ins (
        id TEXT PRIMARY KEY,
        member TEXT NOT NULL,
        note TEXT NOT NULL,
        day INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        UNIQUE(tx_hash, log_index)
      );

      CREATE INDEX IF NOT EXISTS check_ins_order_idx
        ON check_ins(block_number DESC, log_index DESC);

      CREATE INDEX IF NOT EXISTS check_ins_member_day_idx
        ON check_ins(member, day);

      CREATE TABLE IF NOT EXISTS members (
        address TEXT PRIMARY KEY,
        total_check_ins INTEGER NOT NULL,
        first_day INTEGER,
        last_day INTEGER,
        streak_at_last_check_in INTEGER NOT NULL,
        last_check_in_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS monthly_counts (
        month TEXT NOT NULL,
        member TEXT NOT NULL,
        count INTEGER NOT NULL,
        latest_timestamp INTEGER NOT NULL,
        PRIMARY KEY(month, member)
      );

      CREATE INDEX IF NOT EXISTS monthly_counts_rank_idx
        ON monthly_counts(month, count DESC, latest_timestamp ASC);
    `);
  }

  private insertCheckIn(event: CheckInEvent): boolean {
    const normalized = getAddress(event.member).toLowerCase();
    const inserted = this.db
      .prepare(
        `INSERT OR IGNORE INTO check_ins (
          id, member, note, day, timestamp, block_number, tx_hash, log_index
        ) VALUES (
          @id, @member, @note, @day, @timestamp, @blockNumber, @txHash, @logIndex
        )`,
      )
      .run({
        ...event,
        member: normalized,
      });

    if (inserted.changes === 0) {
      return false;
    }

    const previous = this.db
      .prepare("SELECT * FROM members WHERE address = ?")
      .get(normalized) as MemberRow | undefined;
    const streak =
      previous?.last_day === event.day - 1
        ? previous.streak_at_last_check_in + 1
        : 1;
    const firstDay = previous?.first_day ?? event.day;

    this.db
      .prepare(
        `INSERT INTO members (
          address,
          total_check_ins,
          first_day,
          last_day,
          streak_at_last_check_in,
          last_check_in_at
        ) VALUES (
          @address,
          1,
          @firstDay,
          @lastDay,
          @streak,
          @timestamp
        )
        ON CONFLICT(address) DO UPDATE SET
          total_check_ins = total_check_ins + 1,
          first_day = excluded.first_day,
          last_day = excluded.last_day,
          streak_at_last_check_in = excluded.streak_at_last_check_in,
          last_check_in_at = excluded.last_check_in_at`,
      )
      .run({
        address: normalized,
        firstDay,
        lastDay: event.day,
        streak,
        timestamp: event.timestamp,
      });

    const month = monthKeyFromTimestamp(event.timestamp);
    this.db
      .prepare(
        `INSERT INTO monthly_counts (month, member, count, latest_timestamp)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(month, member) DO UPDATE SET
           count = count + 1,
           latest_timestamp = excluded.latest_timestamp`,
      )
      .run(month, normalized, event.timestamp);

    return true;
  }
}

function rowToFeedItem(row: FeedRow): FeedItem {
  return {
    id: row.id,
    member: getAddress(row.member) as `0x${string}`,
    note: row.note,
    day: row.day,
    timestamp: row.timestamp,
    blockNumber: row.block_number,
    txHash: row.tx_hash as `0x${string}`,
    logIndex: row.log_index,
    cursor: `${row.block_number}:${row.log_index}`,
  };
}
