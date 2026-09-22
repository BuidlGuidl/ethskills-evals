import { db } from './db'

/** The indexer's cursor, shared by the indexer itself and the /api/health check. */
const CURSOR_KEY = 'last_indexed_block'

export function readCursor(): bigint | undefined {
  const row = db()
    .prepare<string, { value: string }>('SELECT value FROM indexer_state WHERE key = ?')
    .get(CURSOR_KEY)
  return row ? BigInt(row.value) : undefined
}

export function writeCursor(block: bigint): void {
  db()
    .prepare(
      `INSERT INTO indexer_state (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(CURSOR_KEY, block.toString())
}

export function indexerStatus(): { lastIndexedBlock: number | null } {
  const cursor = readCursor()
  return { lastIndexedBlock: cursor === undefined ? null : Number(cursor) }
}
