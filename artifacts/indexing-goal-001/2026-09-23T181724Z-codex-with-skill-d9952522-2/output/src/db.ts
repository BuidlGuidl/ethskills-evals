import fs from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export async function initSchema(pool: Pool): Promise<void> {
  const schemaPath = path.join(process.cwd(), "read-model", "schema.sql");
  const sql = await fs.readFile(schemaPath, "utf8");
  await pool.query(sql);
}

export async function getLastIndexedBlock(client: Pool | PoolClient): Promise<bigint | null> {
  const result = await client.query<{ value: string }>("select value from indexer_state where key = 'last_indexed_block'");
  return result.rowCount ? BigInt(result.rows[0].value) : null;
}

export async function setLastIndexedBlock(client: PoolClient, blockNumber: bigint): Promise<void> {
  await client.query(
    `
      insert into indexer_state (key, value, updated_at)
      values ('last_indexed_block', $1, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `,
    [blockNumber.toString()],
  );
}

