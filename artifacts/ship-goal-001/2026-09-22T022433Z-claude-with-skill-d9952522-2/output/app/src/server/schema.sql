-- Toolshed offchain store.
--
-- Two kinds of table live here:
--   * member-authored content (members, tools, borrow_requests, loan_offers,
--     return_receipts) — the app owns these;
--   * chain-derived tables (loans, indexer_state) — the indexer owns these and
--     rewrites them from contract events. Nothing outside the indexer writes
--     to `loans`, so the money record always matches the chain.

CREATE TABLE IF NOT EXISTS members (
  address       TEXT PRIMARY KEY,           -- EIP-55 checksummed
  display_name  TEXT NOT NULL DEFAULT '',
  unit_label    TEXT NOT NULL DEFAULT '',   -- "4B", "12 Oak St" — how neighbours find each other
  on_roster     INTEGER NOT NULL DEFAULT 0, -- mirrored from MemberSet events
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tools (
  uuid             TEXT PRIMARY KEY,
  tool_id          TEXT NOT NULL UNIQUE,    -- keccak256 handle used onchain
  owner_address    TEXT NOT NULL,
  title            TEXT NOT NULL,
  condition_notes  TEXT NOT NULL DEFAULT '',
  photo_key        TEXT,
  deposit          TEXT NOT NULL,           -- USDC base units, as a decimal string
  late_fee_per_day TEXT NOT NULL,           -- USDC base units per late day
  max_late_days    INTEGER NOT NULL,        -- cap: late_fee_per_day * max_late_days <= deposit
  max_loan_days    INTEGER NOT NULL,        -- longest loan the owner will sign for
  retired          INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tools_owner ON tools(owner_address);

CREATE TABLE IF NOT EXISTS borrow_requests (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_uuid        TEXT NOT NULL REFERENCES tools(uuid),
  borrower_address TEXT NOT NULL,
  days             INTEGER NOT NULL,
  note             TEXT NOT NULL DEFAULT '',
  -- pending -> offered -> started, or pending -> declined/withdrawn
  status           TEXT NOT NULL DEFAULT 'pending',
  loan_id          INTEGER,                 -- filled in by the indexer on LoanStarted
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_tool ON borrow_requests(tool_uuid, status);
CREATE INDEX IF NOT EXISTS requests_borrower ON borrow_requests(borrower_address, status);

-- An owner-signed set of loan terms, waiting for the borrower to fund the deposit.
CREATE TABLE IF NOT EXISTS loan_offers (
  request_id   INTEGER PRIMARY KEY REFERENCES borrow_requests(id),
  terms_json   TEXT NOT NULL,
  signature    TEXT NOT NULL,
  offer_expiry INTEGER NOT NULL,
  nonce        TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

-- An owner-signed acknowledgement that a tool came back at a given time, which
-- lets the borrower close the loan without waiting for the owner to transact.
CREATE TABLE IF NOT EXISTS return_receipts (
  loan_id     INTEGER PRIMARY KEY,
  returned_at INTEGER NOT NULL,
  signature   TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Chain-derived. Written only by src/indexer.
CREATE TABLE IF NOT EXISTS loans (
  loan_id          INTEGER PRIMARY KEY,
  tool_id          TEXT NOT NULL,
  owner_address    TEXT NOT NULL,
  borrower_address TEXT NOT NULL,
  deposit          TEXT NOT NULL,
  late_fee_per_day TEXT NOT NULL,
  started_at       INTEGER NOT NULL,
  due_at           INTEGER NOT NULL,
  max_late_days    INTEGER NOT NULL,
  status           TEXT NOT NULL,           -- active | settled
  returned_at      INTEGER,
  late_days        INTEGER,
  late_fee         TEXT,
  refund           TEXT,
  route            TEXT,                    -- owner_confirmed | borrower_receipt | borrower_max_late | steward_resolved
  started_block    INTEGER,
  settled_block    INTEGER
);
CREATE INDEX IF NOT EXISTS loans_borrower ON loans(borrower_address, status);
CREATE INDEX IF NOT EXISTS loans_owner ON loans(owner_address, status);
CREATE INDEX IF NOT EXISTS loans_tool ON loans(tool_id, status);

CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce      TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS indexer_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
