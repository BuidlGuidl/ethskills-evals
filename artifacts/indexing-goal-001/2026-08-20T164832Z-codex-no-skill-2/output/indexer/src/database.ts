import Database from "better-sqlite3";

export type CheckIn = {
  id: number;
  account: string;
  day: number;
  note: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
};

export const openDatabase = (path: string) => {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY,
      account TEXT NOT NULL,
      day INTEGER NOT NULL,
      note TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      block_number INTEGER NOT NULL,
      transaction_hash TEXT NOT NULL,
      log_index INTEGER NOT NULL,
      UNIQUE(transaction_hash, log_index),
      UNIQUE(account, day)
    );
    CREATE INDEX IF NOT EXISTS checkins_feed ON checkins(timestamp DESC, id DESC);
    CREATE INDEX IF NOT EXISTS checkins_account ON checkins(account, day DESC);
    CREATE INDEX IF NOT EXISTS checkins_month ON checkins(day, account);
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const getCursor = () => Number(db.prepare("SELECT value FROM sync_state WHERE key = 'cursor'").pluck().get() ?? -1);
  const setCursor = (block: number) => db.prepare(
    "INSERT INTO sync_state(key, value) VALUES ('cursor', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(String(block));

  return { db, getCursor, setCursor };
};

