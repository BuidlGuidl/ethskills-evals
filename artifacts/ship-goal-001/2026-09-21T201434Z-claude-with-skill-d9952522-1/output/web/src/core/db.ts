import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Everything the chain does not need to know about: the member directory,
 * listings, photos, condition notes, and the indexed loan history we build
 * the browse ranking from.
 *
 * SQLite is deliberate — this is a 300-member association, so the whole
 * dataset is a few megabytes. Swap the driver for Postgres if the association
 * ever outgrows a single box; no schema here depends on SQLite specifics.
 */

const DB_PATH = resolve(process.env.TOOLSHED_DB_PATH ?? "./data/toolshed.db");

let instance: Database.Database | null = null;

export function db(): Database.Database {
  if (instance) return instance;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  migrate(conn);
  instance = conn;
  return conn;
}

function migrate(conn: Database.Database) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS members (
      address       TEXT PRIMARY KEY,           -- lowercased 0x address, the member's identity
      display_name  TEXT NOT NULL,
      unit          TEXT,                       -- apartment / house number within the association
      bio           TEXT,
      approved      INTEGER NOT NULL DEFAULT 0, -- association admin vouches for a real neighbor
      joined_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listings (
      id             TEXT PRIMARY KEY,          -- uuid, the app-level listing id
      listing_ref    TEXT NOT NULL UNIQUE,      -- keccak256(id); what the loan carries onchain
      owner_address  TEXT NOT NULL REFERENCES members(address),
      title          TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '',
      condition_note TEXT NOT NULL DEFAULT '',
      photo_url      TEXT,
      deposit        TEXT NOT NULL,             -- USDC base units (6dp), stored as text to stay exact
      daily_late_fee TEXT NOT NULL,
      max_days       INTEGER NOT NULL DEFAULT 7,
      available      INTEGER NOT NULL DEFAULT 1,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_address);
    CREATE INDEX IF NOT EXISTS idx_listings_ref ON listings(listing_ref);

    /* Links an onchain loan back to the listing it was for. Written by the
       borrower's client at request time; the indexer backfills from the
       listingRef hash if the client never reported it. */
    CREATE TABLE IF NOT EXISTS loan_listings (
      loan_id    INTEGER PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id)
    );

    /* Indexed onchain facts. This table is a cache of the chain and can be
       dropped and rebuilt from block 0 at any time. */
    CREATE TABLE IF NOT EXISTS loans (
      loan_id         INTEGER PRIMARY KEY,
      owner_address   TEXT NOT NULL,
      borrower_address TEXT NOT NULL,
      listing_ref     TEXT NOT NULL,
      deposit         TEXT NOT NULL,
      daily_late_fee  TEXT NOT NULL,
      duration_days   INTEGER NOT NULL,
      status          TEXT NOT NULL,            -- requested | active | return_asserted | settled | cancelled
      requested_at    INTEGER NOT NULL,
      due_at          INTEGER,
      asserted_at     INTEGER,
      challenge_ends_at INTEGER,
      objected        INTEGER NOT NULL DEFAULT 0,
      late_fee_paid   TEXT,
      refund          TEXT,
      days_late       INTEGER,
      unreturned      INTEGER NOT NULL DEFAULT 0,
      settled_at      INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_loans_owner ON loans(owner_address);
    CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_address);
    CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

    /* Indexer bookmark, so a restart resumes instead of rescanning. */
    CREATE TABLE IF NOT EXISTS indexer_state (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      last_block      TEXT NOT NULL,
      updated_at      INTEGER NOT NULL
    );

    /* Replay protection for signed API writes. */
    CREATE TABLE IF NOT EXISTS used_nonces (
      nonce      TEXT PRIMARY KEY,
      address    TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
