-- Toolshed offchain store.
--
-- Split of responsibility: everything here is either (a) content the chain has no business
-- holding — photos, condition notes, who asked to borrow what — or (b) a local projection of
-- events the escrow emitted, so the browse screen can sort 300 members without 300 RPC calls.
--
-- Anything in the `loans` table can be rebuilt from scratch by replaying the contract's logs;
-- see src/indexer. Anything in `listings`, `members` or `requests` cannot, and is the part that
-- actually needs backing up.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- members

CREATE TABLE IF NOT EXISTS members (
  address       TEXT PRIMARY KEY,           -- lowercase 0x…
  display_name  TEXT NOT NULL,
  unit_label    TEXT,                       -- "Flat 3B", "14 Elm Row" — how neighbours find each other
  bio           TEXT,
  -- invited: on the association's list, has never signed in.
  -- active:  signed in at least once.
  -- suspended: cannot sign in, cannot be lent to. Existing loans still settle onchain.
  status        TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER
);

-- ---------------------------------------------------------------- listings

CREATE TABLE IF NOT EXISTS listings (
  id                TEXT PRIMARY KEY,       -- bytes32 hex; goes onchain as Terms.listingId
  owner_address     TEXT NOT NULL REFERENCES members(address),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  condition_notes   TEXT NOT NULL DEFAULT '',
  photo_path        TEXT,                   -- served from /uploads
  deposit           TEXT NOT NULL,          -- USDC base units, as a decimal string (uint128)
  daily_late_fee    TEXT NOT NULL,          -- USDC base units per started late day
  max_days          INTEGER NOT NULL,       -- longest loan the owner will agree to
  status            TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'paused', 'retired')),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS listings_owner ON listings(owner_address);
CREATE INDEX IF NOT EXISTS listings_status ON listings(status);

-- ---------------------------------------------------------------- borrow requests
--
-- A request is a conversation, not a commitment. It only becomes binding when the owner signs
-- the terms (`terms_json` + `owner_signature`) and the borrower takes that signature onchain.

CREATE TABLE IF NOT EXISTS requests (
  id                TEXT PRIMARY KEY,
  listing_id        TEXT NOT NULL REFERENCES listings(id),
  borrower_address  TEXT NOT NULL REFERENCES members(address),
  message           TEXT NOT NULL DEFAULT '',
  days              INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'declined', 'opened', 'withdrawn')),
  -- Populated on approval. `loan_id` is keccak256 of the ABI-encoded terms, which is exactly
  -- the id the contract assigns, so we can match the LoanOpened event without guessing.
  terms_json        TEXT,
  owner_signature   TEXT,
  loan_id           TEXT,
  offer_expiry      INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS requests_listing ON requests(listing_id, status);
CREATE INDEX IF NOT EXISTS requests_borrower ON requests(borrower_address, status);
CREATE UNIQUE INDEX IF NOT EXISTS requests_loan ON requests(loan_id) WHERE loan_id IS NOT NULL;

-- ---------------------------------------------------------------- loans (indexed from chain)

CREATE TABLE IF NOT EXISTS loans (
  loan_id           TEXT PRIMARY KEY,
  listing_id        TEXT,                   -- from the event; may reference a deleted listing
  owner_address     TEXT NOT NULL,
  borrower_address  TEXT NOT NULL,
  deposit           TEXT NOT NULL,
  daily_late_fee    TEXT NOT NULL,
  due_at            INTEGER NOT NULL,
  started_at        INTEGER NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('active', 'disputed', 'closed')),
  outcome           TEXT CHECK (outcome IN
                    ('owner_confirmed', 'borrower_receipt', 'forfeited', 'arbitrated')),
  returned_at       INTEGER,
  late_days         INTEGER,
  owner_amount      TEXT,
  borrower_amount   TEXT,
  opened_block      INTEGER NOT NULL,
  opened_tx         TEXT NOT NULL,
  closed_block      INTEGER,
  closed_tx         TEXT
);

CREATE INDEX IF NOT EXISTS loans_owner ON loans(owner_address, status);
CREATE INDEX IF NOT EXISTS loans_borrower ON loans(borrower_address, status);
CREATE INDEX IF NOT EXISTS loans_listing ON loans(listing_id);

-- ---------------------------------------------------------------- return receipts
--
-- Owner-signed proof the tool came back at a given time. Stored so the borrower can still close
-- the loan from any device if the owner never gets round to confirming onchain.

CREATE TABLE IF NOT EXISTS receipts (
  loan_id     TEXT PRIMARY KEY,
  returned_at INTEGER NOT NULL,
  signature   TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- ---------------------------------------------------------------- auth + indexer bookkeeping

CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce      TEXT PRIMARY KEY,
  address    TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS indexer_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
