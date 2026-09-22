import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * One SQLite handle per process. SQLite is the right size for this: a 300-member association
 * generates a few thousand rows a year, and a single file is one less thing for whoever
 * volunteers to run this to keep alive. `src/server/schema.sql` documents what lives here and
 * what is merely a projection of chain events.
 */
let handle: Database.Database | null = null;

export function db(): Database.Database {
  if (handle) return handle;

  const file = process.env.DATABASE_PATH ?? "./data/toolshed.db";
  fs.mkdirSync(path.dirname(path.resolve(file)), {recursive: true});

  handle = new Database(file);
  handle.pragma("journal_mode = WAL");
  handle.pragma("foreign_keys = ON");
  // The indexer and the web process both write; wait rather than throwing SQLITE_BUSY.
  handle.pragma("busy_timeout = 5000");
  return handle;
}

/** Applies schema.sql. Idempotent — every statement is CREATE ... IF NOT EXISTS. */
export function migrate(): void {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "src", "server", "schema.sql"),
    "utf8",
  );
  db().exec(schema);
}

export const now = (): number => Math.floor(Date.now() / 1000);

/** Addresses are stored lowercase everywhere so joins and lookups do not depend on checksums. */
export const normaliseAddress = (address: string): string => address.toLowerCase();
