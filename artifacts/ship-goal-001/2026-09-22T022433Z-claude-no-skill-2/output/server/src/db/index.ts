import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export type Db = Database.Database;

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Opens (and if needed creates) the SQLite database and applies the schema.
 * The schema is idempotent CREATE IF NOT EXISTS, which is all the migration
 * machinery this version needs; see README for the plan past that.
 */
export function openDb(databasePath: string): Db {
  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  // Waits instead of throwing SQLITE_BUSY when another request holds the write lock.
  db.pragma('busy_timeout = 5000');
  if (databasePath !== ':memory:') db.pragma('journal_mode = WAL');

  const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

/** Runs `fn` inside a transaction; nested calls join the outer transaction. */
export function tx<T>(db: Db, fn: () => T): T {
  if (db.inTransaction) return fn();
  return db.transaction(fn)();
}
