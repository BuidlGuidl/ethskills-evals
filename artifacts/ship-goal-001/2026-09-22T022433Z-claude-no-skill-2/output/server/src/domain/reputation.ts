import type { Db } from '../db/index.js';

/**
 * A member's track record. Borrowing and lending are counted separately: being
 * a generous lender says nothing about whether you bring things back on time.
 */
export interface Reputation {
  loansBorrowed: number;   // loans returned as a borrower
  lateReturns: number;
  onTimeReturns: number;
  lateDays: number;        // total late days across returned loans
  loansLent: number;       // loans they handed out as an owner
  activeLoans: number;     // currently out in their hands
  onTimeRate: number | null; // null until they have returned something
  score: number;           // 0-100, see scoreFor()
  tier: Tier;
}

export type Tier = 'new' | 'watch' | 'building' | 'reliable' | 'trusted';

/**
 * Smoothed on-time rate. A brand-new member starts at the prior (80) instead of
 * 0 or 100, so they are lendable but rank below anyone with a real record, and
 * one late return out of fifty barely moves a long-standing member.
 */
const PRIOR_RATE = 0.8;
const PRIOR_WEIGHT = 4;

export function scoreFor(onTimeReturns: number, lateReturns: number): number {
  const total = onTimeReturns + lateReturns;
  const smoothed = (onTimeReturns + PRIOR_RATE * PRIOR_WEIGHT) / (total + PRIOR_WEIGHT);
  return Math.round(smoothed * 1000) / 10;
}

export function tierFor(score: number, completed: number): Tier {
  if (completed === 0) return 'new';
  if (score < 65) return 'watch';
  if (completed >= 5 && score >= 90) return 'trusted';
  if (score >= 80) return 'reliable';
  return 'building';
}

interface StatsRow {
  member_id: string;
  loans_borrowed: number;
  late_returns: number;
  late_days: number;
  loans_lent: number;
  active_loans: number;
}

/**
 * The score as a SQL expression over the `member_stats` view, so the browse
 * screen can ORDER BY it (and paginate) inside SQLite instead of sorting a
 * whole table in memory. Must stay in step with scoreFor() above; the test
 * suite checks the two against each other.
 */
export const SCORE_SQL = `ROUND(
  ((s.loans_borrowed - s.late_returns) + ${PRIOR_RATE} * ${PRIOR_WEIGHT})
  / (CAST(s.loans_borrowed AS REAL) + ${PRIOR_WEIGHT}) * 1000
) / 10`;

const STATS_SQL = 'SELECT * FROM member_stats';

function toReputation(row: StatsRow): Reputation {
  const onTime = row.loans_borrowed - row.late_returns;
  const score = scoreFor(onTime, row.late_returns);
  return {
    loansBorrowed: row.loans_borrowed,
    lateReturns: row.late_returns,
    onTimeReturns: onTime,
    lateDays: row.late_days,
    loansLent: row.loans_lent,
    activeLoans: row.active_loans,
    onTimeRate: row.loans_borrowed === 0 ? null : onTime / row.loans_borrowed,
    score,
    tier: tierFor(score, row.loans_borrowed),
  };
}

export function reputationFor(db: Db, memberId: string): Reputation {
  const row = db.prepare(`${STATS_SQL} WHERE member_id = ?`).get(memberId) as StatsRow | undefined;
  if (!row) {
    return toReputation({
      member_id: memberId,
      loans_borrowed: 0,
      late_returns: 0,
      late_days: 0,
      loans_lent: 0,
      active_loans: 0,
    });
  }
  return toReputation(row);
}

export function reputationMap(db: Db, memberIds: string[]): Map<string, Reputation> {
  const out = new Map<string, Reputation>();
  if (memberIds.length === 0) return out;
  const unique = [...new Set(memberIds)];
  const placeholders = unique.map(() => '?').join(', ');
  const rows = db
    .prepare(`${STATS_SQL} WHERE member_id IN (${placeholders})`)
    .all(...unique) as StatsRow[];
  for (const row of rows) out.set(row.member_id, toReputation(row));
  return out;
}
