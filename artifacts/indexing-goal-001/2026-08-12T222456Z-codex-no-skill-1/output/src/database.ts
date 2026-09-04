import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type StreakDatabase = Database.Database;

export function openDatabase(filename: string) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY,
      member TEXT NOT NULL,
      day INTEGER NOT NULL,
      note TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      block_number INTEGER NOT NULL,
      transaction_hash TEXT NOT NULL,
      log_index INTEGER NOT NULL,
      UNIQUE(member, day)
    );
    CREATE INDEX IF NOT EXISTS check_ins_feed
      ON check_ins(block_number DESC, log_index DESC);
    CREATE INDEX IF NOT EXISTS check_ins_member_day
      ON check_ins(member, day DESC);
    CREATE TABLE IF NOT EXISTS members (
      address TEXT PRIMARY KEY,
      total INTEGER NOT NULL,
      current_streak INTEGER NOT NULL,
      last_day INTEGER NOT NULL,
      last_timestamp INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS monthly_counts (
      month TEXT NOT NULL,
      member TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY(month, member)
    );
    CREATE INDEX IF NOT EXISTS monthly_leaderboard
      ON monthly_counts(month, count DESC, member ASC);
  `);
  return db;
}

export function resetIndexedState(db: StreakDatabase) {
  db.transaction(() => {
    db.exec("DELETE FROM check_ins; DELETE FROM members; DELETE FROM monthly_counts; DELETE FROM metadata;");
  })();
}

export function monthFromTimestamp(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 7);
}
