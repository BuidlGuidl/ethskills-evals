-- Toolshed schema. Applied by db/migrate.ts in a single transaction at boot.
-- Money is integer micro-USDC (1 USDC = 1_000_000). Times are epoch milliseconds.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  unit            TEXT,                      -- apartment / house number within the association
  phone           TEXT,
  password_hash   TEXT NOT NULL,
  is_admin        INTEGER NOT NULL DEFAULT 0,
  payout_address  TEXT,                      -- where withdrawals go once a real USDC rail is wired up
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_member ON sessions(member_id);

CREATE TABLE IF NOT EXISTS tools (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  condition_notes TEXT NOT NULL DEFAULT '',
  photo_key       TEXT,                      -- opaque key for the photo store; NULL = placeholder
  deposit_micros  INTEGER NOT NULL,
  late_fee_micros INTEGER NOT NULL,          -- charged per late day, taken from the deposit
  max_loan_days   INTEGER NOT NULL,
  -- 'available' | 'lent_out' | 'retired'. Denormalised from loans so browse stays one query.
  status          TEXT NOT NULL DEFAULT 'available',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  CHECK (deposit_micros >= 0),
  CHECK (late_fee_micros >= 0),
  CHECK (max_loan_days > 0),
  CHECK (status IN ('available', 'lent_out', 'retired'))
);
CREATE INDEX IF NOT EXISTS tools_owner ON tools(owner_id);
CREATE INDEX IF NOT EXISTS tools_status ON tools(status);

CREATE TABLE IF NOT EXISTS loans (
  id                TEXT PRIMARY KEY,
  tool_id           TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  owner_id          TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  borrower_id       TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  -- requested -> approved -> active -> returned, or declined / cancelled / expired
  status            TEXT NOT NULL,
  requested_days    INTEGER NOT NULL,
  message           TEXT NOT NULL DEFAULT '',
  -- Terms are copied from the tool at request time so later edits cannot move the goalposts.
  deposit_micros    INTEGER NOT NULL,
  late_fee_micros   INTEGER NOT NULL,
  late_fees_charged INTEGER NOT NULL DEFAULT 0,
  -- Late days the deposit actually paid for (may stall when a deposit runs dry)
  late_days_charged INTEGER NOT NULL DEFAULT 0,
  -- Late days on the record, set from the clock at return time. This is what
  -- reputation counts, so an exhausted deposit never launders a late return.
  late_days         INTEGER NOT NULL DEFAULT 0,
  deposit_exhausted INTEGER NOT NULL DEFAULT 0,
  due_at            INTEGER,                 -- set at handover
  handed_over_at    INTEGER,
  returned_at       INTEGER,
  decided_at        INTEGER,                 -- approve / decline / cancel
  decline_reason    TEXT,                    -- owner's note, or why it auto-expired
  closed_at         INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  CHECK (requested_days > 0),
  CHECK (status IN ('requested', 'approved', 'active', 'returned', 'declined', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS loans_tool ON loans(tool_id);
CREATE INDEX IF NOT EXISTS loans_borrower ON loans(borrower_id, status);
CREATE INDEX IF NOT EXISTS loans_owner ON loans(owner_id, status);
CREATE INDEX IF NOT EXISTS loans_active_due ON loans(status, due_at);

-- One tool can only be out on one loan at a time.
CREATE UNIQUE INDEX IF NOT EXISTS loans_one_open_per_tool
  ON loans(tool_id) WHERE status IN ('approved', 'active');

-- ---------------------------------------------------------------------------
-- Ledger: append-only double-entry. Every movement of money is a transfer with
-- entries that sum to zero, so balances are always a SUM over this table.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transfers (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,
  loan_id         TEXT REFERENCES loans(id) ON DELETE SET NULL,
  memo            TEXT NOT NULL DEFAULT '',
  -- Makes retries safe: the same logical event can only post once.
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at      INTEGER NOT NULL,
  CHECK (kind IN ('top_up', 'withdrawal', 'deposit_hold', 'deposit_release', 'late_fee'))
);
CREATE INDEX IF NOT EXISTS transfers_loan ON transfers(loan_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id TEXT NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  -- NULL member_id means the outside world (an on-chain wallet), account 'external'.
  member_id   TEXT REFERENCES members(id) ON DELETE CASCADE,
  account     TEXT NOT NULL,
  amount      INTEGER NOT NULL,              -- signed micro-USDC
  loan_id     TEXT REFERENCES loans(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  CHECK (account IN ('available', 'escrow', 'external')),
  CHECK ((account = 'external') = (member_id IS NULL))
);
CREATE INDEX IF NOT EXISTS ledger_member ON ledger_entries(member_id, account);
CREATE INDEX IF NOT EXISTS ledger_loan ON ledger_entries(loan_id, account);
CREATE INDEX IF NOT EXISTS ledger_transfer ON ledger_entries(transfer_id);

-- ---------------------------------------------------------------------------
-- Track record. Counts only; the score formula lives in domain/reputation.ts
-- (SCORE_SQL) so browse ordering and the API agree by construction.
-- ---------------------------------------------------------------------------

CREATE VIEW IF NOT EXISTS member_stats AS
  SELECT m.id AS member_id,
         COALESCE(b.returned, 0)  AS loans_borrowed,
         COALESCE(b.late, 0)      AS late_returns,
         COALESCE(b.late_days, 0) AS late_days,
         COALESCE(l.lent, 0)      AS loans_lent,
         COALESCE(a.active, 0)    AS active_loans
    FROM members m
    LEFT JOIN (
      SELECT borrower_id,
             COUNT(*) AS returned,
             SUM(CASE WHEN late_days > 0 THEN 1 ELSE 0 END) AS late,
             SUM(late_days) AS late_days
        FROM loans WHERE status = 'returned' GROUP BY borrower_id
    ) b ON b.borrower_id = m.id
    LEFT JOIN (
      SELECT owner_id, COUNT(*) AS lent
        FROM loans WHERE status IN ('active', 'returned') GROUP BY owner_id
    ) l ON l.owner_id = m.id
    LEFT JOIN (
      SELECT borrower_id, COUNT(*) AS active
        FROM loans WHERE status IN ('approved', 'active') GROUP BY borrower_id
    ) a ON a.borrower_id = m.id;
