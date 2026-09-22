/**
 * Track records, derived entirely from settled loans.
 *
 * Nothing here lives onchain. The contract emits `LoanOpened` / `LoanClosed`; the indexer writes
 * those into SQLite; this computes the counts and the ranking score. That means the association
 * can change how reliability is scored — which they will, the first time someone games it —
 * without touching a deployed contract or migrating any onchain state.
 */

export interface TrackRecord {
  address: string;
  displayName: string | null;
  /** Loans this member took out as a borrower and that have settled. */
  loansBorrowed: number;
  /** Of those, how many came back after the due date. */
  lateReturns: number;
  /** Loans where late fees ate the whole deposit — the tool effectively never came back. */
  forfeits: number;
  /** Total days late across every loan, so "one week late once" reads differently to "a day late seven times". */
  lateDaysTotal: number;
  /** Loans this member lent out as an owner and that have settled. */
  loansLent: number;
  /** Late fees this member has collected as an owner, in USDC base units. */
  lateFeesEarned: bigint;
  /** Active loans right now, as borrower. */
  loansOutstanding: number;
  /** Unix seconds of their first settled loan, or null. */
  memberSince: number | null;
}

/**
 * A forfeit is not just a late return — the tool is gone. Count it this heavily when scoring.
 */
export const FORFEIT_WEIGHT = 4;

/**
 * Prior: a new member is treated as though they already had `PRIOR_TOTAL` loans of which
 * `PRIOR_ON_TIME` were on time, so they start at 0.75 rather than at zero.
 *
 * Without this, a brand-new member sorts below everyone and nobody in a 300-person association
 * can get their first loan. With it, a newcomer outranks a demonstrably unreliable member but
 * sits below anyone with a real record — and the prior washes out after a handful of loans.
 */
export const PRIOR_ON_TIME = 3;
export const PRIOR_TOTAL = 4;

/**
 * Reliability in [0, 1]. Used to sort tools on the browse screen (by their owner's score) and to
 * sort an owner's incoming borrow requests (by the requester's score).
 */
export function reliabilityScore(record: {
  loansBorrowed: number;
  lateReturns: number;
  forfeits: number;
}): number {
  const penalised =
    record.lateReturns + record.forfeits * (FORFEIT_WEIGHT - 1);
  const onTime = Math.max(0, record.loansBorrowed - penalised);
  return (onTime + PRIOR_ON_TIME) / (record.loansBorrowed + PRIOR_TOTAL);
}

/** Plain-language label for the score, so the UI never shows a bare decimal. */
export function reliabilityLabel(record: {
  loansBorrowed: number;
  lateReturns: number;
  forfeits: number;
}): string {
  if (record.loansBorrowed === 0) return "New member";
  const onTime = record.loansBorrowed - record.lateReturns;
  const pct = Math.round((onTime / record.loansBorrowed) * 100);
  return `${pct}% on time`;
}

/**
 * Ranking used by the browse screen. Score first; ties broken by the member with the longer
 * record, so twenty clean loans beat three.
 */
export function compareByReliability(a: TrackRecord, b: TrackRecord): number {
  const diff = reliabilityScore(b) - reliabilityScore(a);
  if (Math.abs(diff) > 1e-9) return diff;
  return b.loansBorrowed - a.loansBorrowed;
}

/** An empty record, for a member who has never borrowed or lent. */
export function emptyRecord(address: string, displayName: string | null = null): TrackRecord {
  return {
    address,
    displayName,
    loansBorrowed: 0,
    lateReturns: 0,
    forfeits: 0,
    lateDaysTotal: 0,
    loansLent: 0,
    lateFeesEarned: 0n,
    loansOutstanding: 0,
    memberSince: null,
  };
}
