import pg from "pg";

export const pool = new pg.Pool({ connectionString: required("DATABASE_URL") });

export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkins (
      transaction_hash text NOT NULL,
      log_index integer NOT NULL,
      block_number bigint NOT NULL,
      block_hash text NOT NULL,
      member text NOT NULL,
      day bigint NOT NULL,
      checked_in_at timestamptz NOT NULL,
      note text NOT NULL,
      PRIMARY KEY (transaction_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS checkins_newest ON checkins (checked_in_at DESC, block_number DESC, log_index DESC);
    CREATE INDEX IF NOT EXISTS checkins_member_day ON checkins (member, day DESC);
    CREATE INDEX IF NOT EXISTS checkins_month ON checkins (checked_in_at, member);
    CREATE TABLE IF NOT EXISTS indexer_state (
      name text PRIMARY KEY,
      value bigint NOT NULL
    );
  `);
}
