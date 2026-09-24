import { getAddress, type Address, type Hex } from 'viem'
import { db, now } from './db'
import { getToolByToolId, type Tool } from './tools'
import { trackRecord, type TrackRecord } from './reputation'

export type LoanRoute =
  | 'owner_confirmed'
  | 'borrower_receipt'
  | 'borrower_max_late'
  | 'steward_resolved'

export type Loan = {
  loanId: number
  toolId: Hex
  ownerAddress: Address
  borrowerAddress: Address
  deposit: bigint
  lateFeePerDay: bigint
  startedAt: number
  dueAt: number
  maxLateDays: number
  status: 'active' | 'settled'
  returnedAt: number | null
  lateDays: number | null
  lateFee: bigint | null
  refund: bigint | null
  route: LoanRoute | null
}

export type LoanView = Loan & {
  tool?: Tool
  owner: TrackRecord
  borrower: TrackRecord
  /** Signed return receipt the borrower can use to close the loan, if the owner left one. */
  receipt?: { returnedAt: number; signature: Hex }
  /** Late days that would be charged if it settled right now. */
  lateDaysNow: number
  /** Timestamp at which the borrower may close the loan unilaterally at the capped fee. */
  maxLateFeeAt: number
}

type LoanRow = {
  loan_id: number
  tool_id: string
  owner_address: string
  borrower_address: string
  deposit: string
  late_fee_per_day: string
  started_at: number
  due_at: number
  max_late_days: number
  status: string
  returned_at: number | null
  late_days: number | null
  late_fee: string | null
  refund: string | null
  route: string | null
}

function toLoan(row: LoanRow): Loan {
  return {
    loanId: row.loan_id,
    toolId: row.tool_id as Hex,
    ownerAddress: row.owner_address as Address,
    borrowerAddress: row.borrower_address as Address,
    deposit: BigInt(row.deposit),
    lateFeePerDay: BigInt(row.late_fee_per_day),
    startedAt: row.started_at,
    dueAt: row.due_at,
    maxLateDays: row.max_late_days,
    status: row.status as 'active' | 'settled',
    returnedAt: row.returned_at,
    lateDays: row.late_days,
    lateFee: row.late_fee === null ? null : BigInt(row.late_fee),
    refund: row.refund === null ? null : BigInt(row.refund),
    route: (row.route as LoanRoute | null) ?? null,
  }
}

/** Mirrors `Toolshed.lateDaysFor`: any part of a day past `dueAt` counts as a whole day. */
export function lateDaysAt(loan: Pick<Loan, 'dueAt' | 'maxLateDays'>, at: number): number {
  if (at <= loan.dueAt) return 0
  return Math.min(Math.ceil((at - loan.dueAt) / 86_400), loan.maxLateDays)
}

function decorate(loan: Loan): LoanView {
  const receiptRow = db()
    .prepare<number, { returned_at: number; signature: string }>(
      'SELECT returned_at, signature FROM return_receipts WHERE loan_id = ?',
    )
    .get(loan.loanId)
  return {
    ...loan,
    tool: getToolByToolId(loan.toolId),
    owner: trackRecord(loan.ownerAddress),
    borrower: trackRecord(loan.borrowerAddress),
    receipt: receiptRow
      ? { returnedAt: receiptRow.returned_at, signature: receiptRow.signature as Hex }
      : undefined,
    lateDaysNow: lateDaysAt(loan, now()),
    maxLateFeeAt: loan.dueAt + loan.maxLateDays * 86_400,
  }
}

export function getLoan(loanId: number): LoanView | undefined {
  const row = db().prepare<number, LoanRow>('SELECT * FROM loans WHERE loan_id = ?').get(loanId)
  return row ? decorate(toLoan(row)) : undefined
}

/** Loans involving this member, most recent first, active ones first. */
export function loansFor(address: Address): LoanView[] {
  const who = getAddress(address)
  return db()
    .prepare<[string, string], LoanRow>(
      `SELECT * FROM loans WHERE borrower_address = ? OR owner_address = ?
        ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, started_at DESC`,
    )
    .all(who, who)
    .map(toLoan)
    .map(decorate)
}

export function saveReturnReceipt(input: {
  loanId: number
  returnedAt: number
  signature: string
}): void {
  db()
    .prepare(
      `INSERT INTO return_receipts (loan_id, returned_at, signature, created_at)
       VALUES (@loanId, @returnedAt, @signature, @createdAt)
       ON CONFLICT(loan_id) DO UPDATE SET
         returned_at = @returnedAt, signature = @signature, created_at = @createdAt`,
    )
    .run({ ...input, createdAt: now() })
}

/** Everything still out, most overdue first. The association's nag list. */
export function outstandingLoans(): LoanView[] {
  return db()
    .prepare<[], LoanRow>("SELECT * FROM loans WHERE status = 'active' ORDER BY due_at ASC")
    .all()
    .map(toLoan)
    .map(decorate)
}
