import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// One SQLite file, opened synchronously. At ~300 members the entire dataset is
// a few megabytes and every request is a handful of indexed lookups, so the
// synchronous driver is not a bottleneck and it keeps transactions honest:
// a request either commits or it does not.

const SCHEMA = [
  `CREATE TABLE members (
     id            INTEGER PRIMARY KEY,
     email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
     name          TEXT NOT NULL,
     unit          TEXT NOT NULL DEFAULT '',
     password_hash TEXT NOT NULL,
     wallet_address TEXT NOT NULL DEFAULT '',
     is_admin      INTEGER NOT NULL DEFAULT 0,
     created_at    TEXT NOT NULL
   )`,
  `CREATE TABLE sessions (
     id         TEXT PRIMARY KEY,
     member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL
   )`,
  `CREATE INDEX sessions_member ON sessions(member_id)`,
  `CREATE TABLE tools (
     id              INTEGER PRIMARY KEY,
     owner_id        INTEGER NOT NULL REFERENCES members(id),
     name            TEXT NOT NULL,
     description     TEXT NOT NULL DEFAULT '',
     condition_notes TEXT NOT NULL DEFAULT '',
     photo           TEXT NOT NULL DEFAULT '',
     deposit_amount  TEXT NOT NULL,
     daily_late_fee  TEXT NOT NULL,
     max_days        INTEGER NOT NULL DEFAULT 14,
     status          TEXT NOT NULL DEFAULT 'listed',
     created_at      TEXT NOT NULL
   )`,
  `CREATE INDEX tools_owner ON tools(owner_id)`,
  `CREATE TABLE loans (
     id             INTEGER PRIMARY KEY,
     tool_id        INTEGER NOT NULL REFERENCES tools(id),
     borrower_id    INTEGER NOT NULL REFERENCES members(id),
     owner_id       INTEGER NOT NULL REFERENCES members(id),
     status         TEXT NOT NULL,
     note           TEXT NOT NULL DEFAULT '',
     start_day      TEXT NOT NULL,
     due_day        TEXT NOT NULL,
     deposit_amount TEXT NOT NULL,
     daily_late_fee TEXT NOT NULL,
     requested_at   TEXT NOT NULL,
     decided_at     TEXT,
     decline_reason TEXT NOT NULL DEFAULT '',
     returned_day   TEXT,
     late_days      INTEGER,
     fee_charged    TEXT,
     refund_amount  TEXT,
     closed_at      TEXT
   )`,
  `CREATE INDEX loans_tool ON loans(tool_id, status)`,
  `CREATE INDEX loans_borrower ON loans(borrower_id, status)`,
  `CREATE INDEX loans_owner ON loans(owner_id, status)`,
  `CREATE TABLE ledger_accounts (
     id      TEXT PRIMARY KEY,
     kind    TEXT NOT NULL,
     balance TEXT NOT NULL DEFAULT '0'
   )`,
  `CREATE TABLE ledger_entries (
     id           INTEGER PRIMARY KEY,
     from_account TEXT NOT NULL REFERENCES ledger_accounts(id),
     to_account   TEXT NOT NULL REFERENCES ledger_accounts(id),
     amount       TEXT NOT NULL,
     kind         TEXT NOT NULL,
     loan_id      INTEGER REFERENCES loans(id),
     memo         TEXT NOT NULL DEFAULT '',
     created_at   TEXT NOT NULL
   )`,
  `CREATE INDEX ledger_entries_accounts ON ledger_entries(from_account, to_account)`,
  `CREATE INDEX ledger_entries_loan ON ledger_entries(loan_id)`,
  `CREATE TABLE escrow_holds (
     id          INTEGER PRIMARY KEY,
     loan_id     INTEGER NOT NULL UNIQUE REFERENCES loans(id),
     member_id   INTEGER NOT NULL REFERENCES members(id),
     amount      TEXT NOT NULL,
     status      TEXT NOT NULL,
     reference   TEXT NOT NULL DEFAULT '',
     created_at  TEXT NOT NULL,
     resolved_at TEXT
   )`,
  `CREATE TABLE notices (
     id         INTEGER PRIMARY KEY,
     member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
     loan_id    INTEGER REFERENCES loans(id),
     kind       TEXT NOT NULL,
     body       TEXT NOT NULL,
     created_at TEXT NOT NULL,
     read_at    TEXT
   )`,
  `CREATE INDEX notices_member ON notices(member_id, read_at)`,
  `CREATE UNIQUE INDEX notices_dedupe ON notices(member_id, loan_id, kind, substr(created_at, 1, 10))`,
];

/** Ordered list of migrations. Append only; never edit one that has shipped. */
const MIGRATIONS = [{ name: '001-initial', statements: SCHEMA }];

let database = null;

export function db() {
  if (!database) database = open(config.databasePath);
  return database;
}

export function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const handle = new DatabaseSync(file);
  handle.exec('PRAGMA journal_mode = WAL');
  handle.exec('PRAGMA foreign_keys = ON');
  handle.exec('PRAGMA busy_timeout = 5000');
  migrate(handle);
  return handle;
}

export function migrate(handle) {
  handle.exec(`CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const applied = new Set(
    handle.prepare('SELECT name FROM migrations').all().map((row) => row.name),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    handle.exec('BEGIN');
    try {
      for (const statement of migration.statements) handle.exec(statement);
      handle
        .prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)')
        .run(migration.name, new Date().toISOString());
      handle.exec('COMMIT');
    } catch (error) {
      handle.exec('ROLLBACK');
      throw error;
    }
  }
}

/** Run `fn` inside a transaction; rolls back if it throws. Not re-entrant. */
export function transaction(handle, fn) {
  handle.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    handle.exec('COMMIT');
    return result;
  } catch (error) {
    handle.exec('ROLLBACK');
    throw error;
  }
}
