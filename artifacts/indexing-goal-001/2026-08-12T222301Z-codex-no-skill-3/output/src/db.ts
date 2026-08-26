import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type CheckIn = {
  txHash: string;
  logIndex: number;
  member: string;
  day: number;
  note: string;
  blockNumber: number;
  timestamp: number;
};

export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS check_ins (
      tx_hash TEXT NOT NULL, log_index INTEGER NOT NULL, member TEXT NOT NULL,
      day INTEGER NOT NULL, note TEXT NOT NULL, block_number INTEGER NOT NULL,
      timestamp INTEGER NOT NULL, PRIMARY KEY (tx_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS check_ins_feed ON check_ins(block_number DESC, log_index DESC);
    CREATE INDEX IF NOT EXISTS check_ins_member_day ON check_ins(member, day DESC);
    CREATE INDEX IF NOT EXISTS check_ins_day_member ON check_ins(day, member);
    CREATE TABLE IF NOT EXISTS sync_state (
      singleton INTEGER PRIMARY KEY CHECK(singleton = 1), next_block TEXT NOT NULL
    );
  `);
  return db;
}

export type StreakDb = ReturnType<typeof openDb>;

export function insertBatch(db: StreakDb, rows: CheckIn[], nextBlock: bigint) {
  const insert = db.prepare(`INSERT OR IGNORE INTO check_ins
    (tx_hash,log_index,member,day,note,block_number,timestamp)
    VALUES (@txHash,@logIndex,@member,@day,@note,@blockNumber,@timestamp)`);
  const commit = db.transaction(() => {
    for (const row of rows) insert.run(row);
    db.prepare(`INSERT INTO sync_state(singleton,next_block) VALUES(1,?)
      ON CONFLICT(singleton) DO UPDATE SET next_block=excluded.next_block`).run(nextBlock.toString());
  });
  commit();
}

export function getNextBlock(db: StreakDb, fallback: bigint) {
  const row = db.prepare("SELECT next_block FROM sync_state WHERE singleton=1").get() as { next_block: string } | undefined;
  return row ? BigInt(row.next_block) : fallback;
}
