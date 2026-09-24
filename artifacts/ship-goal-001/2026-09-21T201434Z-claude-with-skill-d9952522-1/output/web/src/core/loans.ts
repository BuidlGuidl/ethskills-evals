import { db } from "./db";
import { trackRecordFor, type TrackRecord } from "./reputation";

export type LoanStatus = "requested" | "active" | "return_asserted" | "settled" | "cancelled";

export type Loan = {
  loanId: number;
  ownerAddress: string;
  borrowerAddress: string;
  listingId: string | null;
  listingTitle: string | null;
  listingPhotoUrl: string | null;
  deposit: string;
  dailyLateFee: string;
  durationDays: number;
  status: LoanStatus;
  requestedAt: number;
  dueAt: number | null;
  assertedAt: number | null;
  challengeEndsAt: number | null;
  objected: boolean;
  lateFeePaid: string | null;
  refund: string | null;
  daysLate: number | null;
  unreturned: boolean;
  owner: TrackRecord;
  borrower: TrackRecord;
  /** Live estimate for an in-flight loan, so the UI can show what is at stake. */
  projectedLateFee: string;
  projectedDaysLate: number;
};

type LoanRow = {
  loan_id: number;
  owner_address: string;
  borrower_address: string;
  deposit: string;
  daily_late_fee: string;
  duration_days: number;
  status: LoanStatus;
  requested_at: number;
  due_at: number | null;
  asserted_at: number | null;
  challenge_ends_at: number | null;
  objected: number;
  late_fee_paid: string | null;
  refund: string | null;
  days_late: number | null;
  unreturned: number;
  listing_id: string | null;
  listing_title: string | null;
  listing_photo_url: string | null;
};

/**
 * Mirrors `Toolshed._lateFeeAt`. Any started day past the due date counts as a
 * whole day, and the total is capped at the deposit.
 *
 * This is a preview only. The contract recomputes it at settlement and that
 * result is the one that moves money.
 */
export function projectLateFee(
  loan: { dueAt: number | null; assertedAt: number | null; deposit: string; dailyLateFee: string },
  atSeconds: number,
): { fee: bigint; daysLate: number } {
  if (!loan.dueAt) return { fee: 0n, daysLate: 0 };

  // Accrual freezes when the borrower asserts the return.
  const end = loan.assertedAt ?? atSeconds;
  if (end <= loan.dueAt) return { fee: 0n, daysLate: 0 };

  const daysLate = Math.ceil((end - loan.dueAt) / 86_400);
  const deposit = BigInt(loan.deposit);
  const raw = BigInt(daysLate) * BigInt(loan.dailyLateFee);
  return { fee: raw > deposit ? deposit : raw, daysLate };
}

const SELECT_LOANS = `
  SELECT ln.*, ll.listing_id AS listing_id, li.title AS listing_title, li.photo_url AS listing_photo_url
  FROM loans ln
  LEFT JOIN loan_listings ll ON ll.loan_id = ln.loan_id
  LEFT JOIN listings li ON li.id = ll.listing_id
`;

function hydrate(row: LoanRow): Loan {
  const base = {
    dueAt: row.due_at,
    assertedAt: row.asserted_at,
    deposit: row.deposit,
    dailyLateFee: row.daily_late_fee,
  };
  const projected = projectLateFee(base, Math.floor(Date.now() / 1000));

  return {
    loanId: row.loan_id,
    ownerAddress: row.owner_address,
    borrowerAddress: row.borrower_address,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    listingPhotoUrl: row.listing_photo_url,
    deposit: row.deposit,
    dailyLateFee: row.daily_late_fee,
    durationDays: row.duration_days,
    status: row.status,
    requestedAt: row.requested_at,
    dueAt: row.due_at,
    assertedAt: row.asserted_at,
    challengeEndsAt: row.challenge_ends_at,
    objected: row.objected === 1,
    lateFeePaid: row.late_fee_paid,
    refund: row.refund,
    daysLate: row.days_late,
    unreturned: row.unreturned === 1,
    owner: trackRecordFor(row.owner_address),
    borrower: trackRecordFor(row.borrower_address),
    projectedLateFee: projected.fee.toString(),
    projectedDaysLate: projected.daysLate,
  };
}

/** Every loan the member is party to, either side, newest first. */
export function loansFor(address: string): Loan[] {
  const rows = db()
    .prepare(`${SELECT_LOANS} WHERE ln.owner_address = ? OR ln.borrower_address = ? ORDER BY ln.loan_id DESC`)
    .all(address.toLowerCase(), address.toLowerCase()) as LoanRow[];
  return rows.map(hydrate);
}

export function getLoan(loanId: number): Loan | null {
  const row = db().prepare(`${SELECT_LOANS} WHERE ln.loan_id = ?`).get(loanId) as LoanRow | undefined;
  return row ? hydrate(row) : null;
}

export function loansForListing(listingId: string): Loan[] {
  const rows = db()
    .prepare(`${SELECT_LOANS} WHERE ll.listing_id = ? ORDER BY ln.loan_id DESC`)
    .all(listingId) as LoanRow[];
  return rows.map(hydrate);
}

/** Records which listing a freshly-submitted loan was for. */
export function linkLoanToListing(loanId: number, listingId: string) {
  db()
    .prepare("INSERT INTO loan_listings (loan_id, listing_id) VALUES (?, ?) ON CONFLICT(loan_id) DO NOTHING")
    .run(loanId, listingId);
}
