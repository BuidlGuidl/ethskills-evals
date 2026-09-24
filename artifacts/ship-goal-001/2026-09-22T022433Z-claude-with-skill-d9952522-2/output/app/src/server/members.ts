import { getAddress, type Address } from 'viem'
import { db, now } from './db'

/**
 * Member profiles are pure offchain content: a name and a unit number so
 * neighbours can find each other. Roster membership itself lives onchain and is
 * mirrored into `members.on_roster` by the indexer.
 */

export type MemberProfile = {
  address: Address
  displayName: string
  unitLabel: string
  onRoster: boolean
}

export function getProfile(address: Address): MemberProfile | undefined {
  const row = db()
    .prepare<string, { address: string; display_name: string; unit_label: string; on_roster: number }>(
      'SELECT address, display_name, unit_label, on_roster FROM members WHERE address = ?',
    )
    .get(getAddress(address))
  if (!row) return undefined
  return {
    address: row.address as Address,
    displayName: row.display_name,
    unitLabel: row.unit_label,
    onRoster: row.on_roster === 1,
  }
}

export function saveProfile(input: {
  address: Address
  displayName: string
  unitLabel: string
}): void {
  db()
    .prepare(
      `INSERT INTO members (address, display_name, unit_label, created_at)
       VALUES (@address, @displayName, @unitLabel, @createdAt)
       ON CONFLICT(address) DO UPDATE SET display_name = @displayName, unit_label = @unitLabel`,
    )
    .run({
      address: getAddress(input.address),
      displayName: input.displayName,
      unitLabel: input.unitLabel,
      createdAt: now(),
    })
}

export function setRosterFlag(address: Address, onRoster: boolean): void {
  db()
    .prepare(
      `INSERT INTO members (address, on_roster, created_at)
       VALUES (@address, @onRoster, @createdAt)
       ON CONFLICT(address) DO UPDATE SET on_roster = @onRoster`,
    )
    .run({ address: getAddress(address), onRoster: onRoster ? 1 : 0, createdAt: now() })
}

/** Label for the UI: a name if we have one, otherwise a shortened address. */
export function displayNameFor(address: Address, displayName?: string): string {
  if (displayName) return displayName
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
