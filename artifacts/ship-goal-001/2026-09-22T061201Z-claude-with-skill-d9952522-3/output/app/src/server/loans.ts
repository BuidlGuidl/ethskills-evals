import {db, normaliseAddress, now} from "./db.ts";
import type {LoanOutcome, LoanStatus} from "@/core/loan.ts";

export interface Loan {
  loanId: string;
  listingId: string | null;
  listingTitle: string | null;
  photoPath: string | null;
  ownerAddress: string;
  ownerName: string | null;
  borrowerAddress: string;
  borrowerName: string | null;
  deposit: bigint;
  dailyLateFee: bigint;
  dueAt: number;
  startedAt: number;
  status: LoanStatus;
  outcome: LoanOutcome | null;
  returnedAt: number | null;
  lateDays: number | null;
  ownerAmount: bigint | null;
  borrowerAmount: bigint | null;
  openedTx: string;
  closedTx: string | null;
  /** An owner-signed return receipt, if one has been handed over. */
  receipt: {returnedAt: number; signature: string} | null;
}

interface LoanRow {
  loan_id: string;
  listing_id: string | null;
  listing_title: string | null;
  photo_path: string | null;
  owner_address: string;
  owner_name: string | null;
  borrower_address: string;
  borrower_name: string | null;
  deposit: string;
  daily_late_fee: string;
  due_at: number;
  started_at: number;
  status: LoanStatus;
  outcome: LoanOutcome | null;
  returned_at: number | null;
  late_days: number | null;
  owner_amount: string | null;
  borrower_amount: string | null;
  opened_tx: string;
  closed_tx: string | null;
  receipt_returned_at: number | null;
  receipt_signature: string | null;
}

const SELECT = `
  SELECT ln.*,
         li.title AS listing_title,
         li.photo_path,
         o.display_name AS owner_name,
         b.display_name AS borrower_name,
         rc.returned_at AS receipt_returned_at,
         rc.signature   AS receipt_signature
    FROM loans ln
    LEFT JOIN listings li ON li.id = ln.listing_id
    LEFT JOIN members o ON o.address = ln.owner_address
    LEFT JOIN members b ON b.address = ln.borrower_address
    LEFT JOIN receipts rc ON rc.loan_id = ln.loan_id`;

const toLoan = (row: LoanRow): Loan => ({
  loanId: row.loan_id,
  listingId: row.listing_id,
  listingTitle: row.listing_title,
  photoPath: row.photo_path,
  ownerAddress: row.owner_address,
  ownerName: row.owner_name,
  borrowerAddress: row.borrower_address,
  borrowerName: row.borrower_name,
  deposit: BigInt(row.deposit),
  dailyLateFee: BigInt(row.daily_late_fee),
  dueAt: row.due_at,
  startedAt: row.started_at,
  status: row.status,
  outcome: row.outcome,
  returnedAt: row.returned_at,
  lateDays: row.late_days,
  ownerAmount: row.owner_amount === null ? null : BigInt(row.owner_amount),
  borrowerAmount: row.borrower_amount === null ? null : BigInt(row.borrower_amount),
  openedTx: row.opened_tx,
  closedTx: row.closed_tx,
  receipt:
    row.receipt_signature && row.receipt_returned_at !== null
      ? {returnedAt: row.receipt_returned_at, signature: row.receipt_signature}
      : null,
});

export function getLoan(loanId: string): Loan | null {
  const row = db().prepare(`${SELECT} WHERE ln.loan_id = ?`).get(loanId) as LoanRow | undefined;
  return row ? toLoan(row) : null;
}

/** Every loan a member is party to, newest first, whichever side they were on. */
export function loansForMember(address: string): Loan[] {
  const normalised = normaliseAddress(address);
  const rows = db()
    .prepare(
      `${SELECT} WHERE ln.owner_address = ? OR ln.borrower_address = ?
        ORDER BY (ln.status = 'closed'), ln.due_at ASC`,
    )
    .all(normalised, normalised) as LoanRow[];
  return rows.map(toLoan);
}

export function loansForListing(listingId: string): Loan[] {
  const rows = db()
    .prepare(`${SELECT} WHERE ln.listing_id = ? ORDER BY ln.started_at DESC`)
    .all(listingId) as LoanRow[];
  return rows.map(toLoan);
}

/** Stores the owner's signed return receipt so the borrower can close the loan themselves. */
export function saveReceipt(loanId: string, returnedAt: number, signature: string): void {
  db()
    .prepare(
      `INSERT INTO receipts (loan_id, returned_at, signature, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(loan_id) DO UPDATE SET returned_at = excluded.returned_at,
                                          signature = excluded.signature`,
    )
    .run(loanId, returnedAt, signature, now());
}
