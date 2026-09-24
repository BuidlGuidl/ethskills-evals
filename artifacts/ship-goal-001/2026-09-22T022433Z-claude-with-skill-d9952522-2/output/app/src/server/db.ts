import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * SQLite is deliberate: ~300 members generate a few thousand rows a year, and a
 * single file is one less thing for a volunteer to operate. `DATABASE_PATH` can
 * point anywhere; swapping in Postgres later means replacing this module.
 */
// turbopackIgnore: the path is configuration, not a build-time import.
const dbPath = resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH ?? './data/toolshed.db')

let instance: Database.Database | undefined

export function db(): Database.Database {
  if (!instance) {
    mkdirSync(dirname(dbPath), { recursive: true })
    instance = new Database(dbPath)
    instance.pragma('journal_mode = WAL')
    instance.pragma('foreign_keys = ON')
    instance.pragma('busy_timeout = 5000')
  }
  return instance
}

export function migrate(database: Database.Database = db()): void {
  const schema = readFileSync(resolve(import.meta.dirname, 'schema.sql'), 'utf8')
  database.exec(schema)
}

export const now = () => Math.floor(Date.now() / 1000)
