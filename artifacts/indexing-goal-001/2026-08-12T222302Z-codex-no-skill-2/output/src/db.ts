import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS check_ins (
      tx_hash TEXT NOT NULL,
      log_index INTEGER NOT NULL,
      block_number INTEGER NOT NULL,
      block_hash TEXT NOT NULL,
      member TEXT NOT NULL,
      day INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      note TEXT NOT NULL,
      PRIMARY KEY (tx_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS check_ins_feed ON check_ins(timestamp DESC, log_index DESC);
    CREATE INDEX IF NOT EXISTS check_ins_member_day ON check_ins(member, day DESC);
    CREATE INDEX IF NOT EXISTS check_ins_day_member ON check_ins(day, member);
    CREATE TABLE IF NOT EXISTS indexed_blocks (
      number INTEGER PRIMARY KEY,
      hash TEXT NOT NULL
    );
  `);
  return db;
}

export type StreakDatabase = ReturnType<typeof openDatabase>;

