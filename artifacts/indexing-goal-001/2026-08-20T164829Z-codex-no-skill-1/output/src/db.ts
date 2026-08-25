import pg from "pg";

export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sync_state (
      name text PRIMARY KEY,
      next_block bigint NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checkins (
      transaction_hash text NOT NULL,
      log_index integer NOT NULL,
      block_number bigint NOT NULL,
      block_timestamp timestamptz NOT NULL,
      member text NOT NULL,
      day bigint NOT NULL,
      note text NOT NULL,
      PRIMARY KEY (transaction_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS checkins_feed ON checkins (block_number DESC, log_index DESC);
    CREATE INDEX IF NOT EXISTS checkins_member_day ON checkins (member, day DESC);
    CREATE INDEX IF NOT EXISTS checkins_month ON checkins (block_timestamp, member);
  `);
}
