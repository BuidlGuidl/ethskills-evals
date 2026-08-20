CREATE TABLE IF NOT EXISTS indexer_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  member TEXT NOT NULL,
  day BIGINT NOT NULL,
  note TEXT NOT NULL,
  PRIMARY KEY (transaction_hash, log_index),
  UNIQUE (member, day)
);

CREATE INDEX IF NOT EXISTS checkins_feed_idx ON checkins (block_timestamp DESC, block_number DESC, log_index DESC);
CREATE INDEX IF NOT EXISTS checkins_member_idx ON checkins (member, day DESC);
CREATE INDEX IF NOT EXISTS checkins_month_idx ON checkins (block_timestamp, member);
