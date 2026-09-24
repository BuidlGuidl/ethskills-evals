import { db, now } from './db'
import type { Address } from 'viem'

/**
 * Track records are derived, never stored onchain.
 *
 * Everything here is computed from the `loans` table, which the indexer builds
 * from `LoanStarted` / `LoanSettled` events. That keeps the contract small and
 * lets us change the ranking formula — which we will — without a migration or a
 * redeploy.
 */

export type TrackRecord = {
  address: Address
  displayName: string
  unitLabel: string
  onRoster: boolean
  /** Settled loans where this member was the borrower. */
  borrowed: number
  /** Of those, how many came back late. */
  lateReturns: number
  onTimeReturns: number
  /** Late days billed to them across all settled loans. */
  lateDays: number
  /** Loans currently out to them, and how many of those are already overdue. */
  activeLoans: number
  overdueNow: number
  /** Settled loans where this member was the tool owner. */
  lent: number
  /** Late fees this member has collected as an owner, in USDC base units. */
  lateFeesEarned: bigint
  /**
   * Laplace-smoothed on-time rate in [0,1]. A brand-new member sits at 0.5
   * rather than at the bottom, so the first loan of their life is possible;
   * one late return out of twenty barely moves them.
   */
  reliability: number
}

type Row = {
  address: string
  display_name: string
  unit_label: string
  on_roster: number
  borrowed: number
  late_returns: number
  late_days: number
  active_loans: number
  overdue_now: number
  lent: number
  late_fees_earned: string | null
}

const RECORD_SQL = `
  SELECT
    m.address,
    m.display_name,
    m.unit_label,
    m.on_roster,
    (SELECT COUNT(*) FROM loans l
       WHERE l.borrower_address = m.address AND l.status = 'settled')                AS borrowed,
    (SELECT COUNT(*) FROM loans l
       WHERE l.borrower_address = m.address AND l.status = 'settled'
         AND l.late_days > 0)                                                        AS late_returns,
    (SELECT COALESCE(SUM(l.late_days), 0) FROM loans l
       WHERE l.borrower_address = m.address AND l.status = 'settled')                AS late_days,
    (SELECT COUNT(*) FROM loans l
       WHERE l.borrower_address = m.address AND l.status = 'active')                 AS active_loans,
    (SELECT COUNT(*) FROM loans l
       WHERE l.borrower_address = m.address AND l.status = 'active'
         AND l.due_at < @now)                                                        AS overdue_now,
    (SELECT COUNT(*) FROM loans l
       WHERE l.owner_address = m.address AND l.status = 'settled')                   AS lent,
    (SELECT COALESCE(SUM(CAST(l.late_fee AS INTEGER)), 0) FROM loans l
       WHERE l.owner_address = m.address AND l.status = 'settled')                   AS late_fees_earned
  FROM members m
`

function toRecord(row: Row): TrackRecord {
  const borrowed = row.borrowed
  const lateReturns = row.late_returns
  const onTimeReturns = borrowed - lateReturns
  return {
    address: row.address as Address,
    displayName: row.display_name,
    unitLabel: row.unit_label,
    onRoster: row.on_roster === 1,
    borrowed,
    lateReturns,
    onTimeReturns,
    lateDays: row.late_days,
    activeLoans: row.active_loans,
    overdueNow: row.overdue_now,
    lent: row.lent,
    lateFeesEarned: BigInt(row.late_fees_earned ?? '0'),
    reliability: (onTimeReturns + 1) / (borrowed + 2),
  }
}

export function trackRecord(address: Address): TrackRecord {
  const row = db()
    .prepare<{ now: number; address: string }, Row>(`${RECORD_SQL} WHERE m.address = @address`)
    .get({ now: now(), address })
  return row
    ? toRecord(row)
    : toRecord({
        address,
        display_name: '',
        unit_label: '',
        on_roster: 0,
        borrowed: 0,
        late_returns: 0,
        late_days: 0,
        active_loans: 0,
        overdue_now: 0,
        lent: 0,
        late_fees_earned: '0',
      })
}

export function allTrackRecords(): TrackRecord[] {
  const rows = db().prepare<{ now: number }, Row>(RECORD_SQL).all({ now: now() })
  return rows.map(toRecord).sort(compareReliability)
}

export function trackRecordsFor(addresses: Address[]): Map<Address, TrackRecord> {
  const map = new Map<Address, TrackRecord>()
  for (const address of new Set(addresses)) map.set(address, trackRecord(address))
  return map
}

/**
 * The browse ordering: reliable members first.
 *
 * 1. Anyone holding an overdue tool right now drops to the back — that is the
 *    signal the association actually cares about.
 * 2. Then by smoothed on-time rate.
 * 3. Then by volume, so a long clean history outranks a short one.
 */
export function compareReliability(a: TrackRecord, b: TrackRecord): number {
  if ((a.overdueNow > 0) !== (b.overdueNow > 0)) return a.overdueNow > 0 ? 1 : -1
  if (b.reliability !== a.reliability) return b.reliability - a.reliability
  return b.borrowed - a.borrowed
}

/** Short human summary, e.g. "7 loans · 1 late". */
export function summarize(record: TrackRecord): string {
  if (record.borrowed === 0 && record.activeLoans === 0) return 'no loans yet'
  const parts = [`${record.borrowed} ${record.borrowed === 1 ? 'loan' : 'loans'}`]
  parts.push(`${record.lateReturns} late`)
  if (record.overdueNow > 0) parts.push(`${record.overdueNow} overdue now`)
  return parts.join(' · ')
}
