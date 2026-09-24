import { db } from "./db";

/**
 * Track record is *derived data*. Nothing here is stored onchain — the
 * contract only emits what happened (LoanSettled carries daysLate and
 * unreturned), and we aggregate it over the indexed `loans` table.
 *
 * That means the ranking formula below can change whenever the association
 * wants it to, with no migration and no contract redeploy.
 */

export type TrackRecord = {
  address: string;
  displayName: string | null;
  /** Loans completed as the borrower. */
  loansBorrowed: number;
  /** Of those, how many came back after the due date. */
  lateReturns: number;
  /** Tools never returned at all (deposit fully consumed). */
  unreturned: number;
  /** Loans completed as the lender — someone who lends is also building trust. */
  loansLent: number;
  /** Total days late across all their borrows. */
  totalDaysLate: number;
  /** 0..1, higher is more reliable. Null when they have no history yet. */
  onTimeRate: number | null;
  /** Ranking key used by the browse screen. */
  score: number;
};

const EMPTY = {
  loansBorrowed: 0,
  lateReturns: 0,
  unreturned: 0,
  loansLent: 0,
  totalDaysLate: 0,
};

/**
 * Wilson lower bound on the on-time rate at 95% confidence.
 *
 * A plain ratio ranks a member with one flawless loan above a member with
 * forty loans and one late return, which is backwards for "lend to the
 * reliable people first". The lower bound of the confidence interval pushes
 * thin histories toward the middle until they have earned a position.
 */
function wilsonLowerBound(successes: number, total: number): number {
  if (total === 0) return 0;
  const z = 1.96;
  const phat = successes / total;
  const denom = 1 + (z * z) / total;
  const centre = phat + (z * z) / (2 * total);
  const margin = z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total);
  return (centre - margin) / denom;
}

export function scoreFor(stats: {
  loansBorrowed: number;
  lateReturns: number;
  unreturned: number;
  loansLent: number;
}): number {
  const onTime = stats.loansBorrowed - stats.lateReturns;
  let score = wilsonLowerBound(onTime, stats.loansBorrowed);

  // Lending your own tools out is its own signal of good standing; worth a
  // nudge, but never enough to outweigh actually returning things on time.
  score += Math.min(stats.loansLent, 10) * 0.005;

  // Losing a neighbor's tool outright is categorically worse than being late.
  score -= stats.unreturned * 0.25;

  return Math.max(0, Math.min(1, score));
}

type Row = {
  address: string;
  display_name: string | null;
  loans_borrowed: number;
  late_returns: number;
  unreturned: number;
  loans_lent: number;
  total_days_late: number;
};

const TRACK_RECORD_SQL = `
  SELECT
    m.address                                        AS address,
    m.display_name                                   AS display_name,
    COALESCE(b.n, 0)                                 AS loans_borrowed,
    COALESCE(b.late, 0)                              AS late_returns,
    COALESCE(b.lost, 0)                              AS unreturned,
    COALESCE(l.n, 0)                                 AS loans_lent,
    COALESCE(b.days_late, 0)                         AS total_days_late
  FROM members m
  LEFT JOIN (
    SELECT borrower_address AS addr,
           COUNT(*)                                  AS n,
           SUM(CASE WHEN days_late > 0 THEN 1 ELSE 0 END) AS late,
           SUM(unreturned)                           AS lost,
           SUM(COALESCE(days_late, 0))               AS days_late
    FROM loans WHERE status = 'settled' GROUP BY borrower_address
  ) b ON b.addr = m.address
  LEFT JOIN (
    SELECT owner_address AS addr, COUNT(*) AS n
    FROM loans WHERE status = 'settled' GROUP BY owner_address
  ) l ON l.addr = m.address
`;

function toTrackRecord(row: Row): TrackRecord {
  const stats = {
    loansBorrowed: row.loans_borrowed,
    lateReturns: row.late_returns,
    unreturned: row.unreturned,
    loansLent: row.loans_lent,
  };
  return {
    address: row.address,
    displayName: row.display_name,
    ...stats,
    totalDaysLate: row.total_days_late,
    onTimeRate:
      stats.loansBorrowed === 0 ? null : (stats.loansBorrowed - stats.lateReturns) / stats.loansBorrowed,
    score: scoreFor(stats),
  };
}

export function trackRecordFor(address: string): TrackRecord {
  const row = db()
    .prepare(`${TRACK_RECORD_SQL} WHERE m.address = ?`)
    .get(address.toLowerCase()) as Row | undefined;

  if (!row) {
    return {
      address: address.toLowerCase(),
      displayName: null,
      ...EMPTY,
      onTimeRate: null,
      score: scoreFor(EMPTY),
    };
  }
  return toTrackRecord(row);
}

export function allTrackRecords(): Map<string, TrackRecord> {
  const rows = db().prepare(TRACK_RECORD_SQL).all() as Row[];
  return new Map(rows.map((r) => [r.address, toTrackRecord(r)]));
}
