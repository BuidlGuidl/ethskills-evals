import type { Db } from '../db/index.js';
import { config } from '../config.js';
import { formatUsdc } from '../lib/money.js';
import { toIso } from '../lib/time.js';
import type { MemberRow } from '../domain/members.js';
import type { LoanRow } from '../domain/loans.js';
import type { ToolRow } from '../domain/tools.js';
import type { Balances, LedgerRow } from '../domain/ledger.js';
import { reputationFor, type Reputation } from '../domain/reputation.js';

/** Amounts go out as both integer micros (for maths) and a string (for display). */
export function money(micros: number) {
  return { micros, usdc: formatUsdc(micros) };
}

export function publicMember(member: MemberRow, reputation?: Reputation) {
  return {
    id: member.id,
    displayName: member.display_name,
    unit: member.unit,
    memberSince: toIso(member.created_at),
    reputation,
  };
}

export function privateMember(member: MemberRow, reputation: Reputation, balances: Balances) {
  return {
    ...publicMember(member, reputation),
    email: member.email,
    phone: member.phone,
    isAdmin: !!member.is_admin,
    payoutAddress: member.payout_address,
    balances: { available: money(balances.available), escrow: money(balances.escrow) },
  };
}

export function photoUrl(key: string | null): string | null {
  return key ? `/api/photos/${key}` : null;
}

export function publicTool(tool: ToolRow) {
  return {
    id: tool.id,
    ownerId: tool.owner_id,
    name: tool.name,
    category: tool.category,
    description: tool.description,
    conditionNotes: tool.condition_notes,
    photoUrl: photoUrl(tool.photo_key),
    deposit: money(tool.deposit_micros),
    lateFeePerDay: money(tool.late_fee_micros),
    maxLoanDays: tool.max_loan_days,
    status: tool.status,
    createdAt: toIso(tool.created_at),
  };
}

function depositRemaining(db: Db, loan: LoanRow): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries
        WHERE loan_id = ? AND account = 'escrow'`,
    )
    .get(loan.id) as { total: number };
  return row.total;
}

export function publicLoan(db: Db, loan: LoanRow, nowMs = Date.now()) {
  const overdue = loan.status === 'active' && loan.due_at !== null && nowMs > loan.due_at;
  return {
    id: loan.id,
    toolId: loan.tool_id,
    ownerId: loan.owner_id,
    borrowerId: loan.borrower_id,
    status: loan.status,
    requestedDays: loan.requested_days,
    message: loan.message,
    declineReason: loan.decline_reason,
    deposit: money(loan.deposit_micros),
    lateFeePerDay: money(loan.late_fee_micros),
    lateFeesCharged: money(loan.late_fees_charged),
    lateDaysCharged: loan.late_days_charged,
    lateDays: loan.late_days,
    depositExhausted: !!loan.deposit_exhausted,
    depositRemaining: money(depositRemaining(db, loan)),
    overdue,
    graceHours: config.lateGraceHours,
    dueAt: toIso(loan.due_at),
    handedOverAt: toIso(loan.handed_over_at),
    returnedAt: toIso(loan.returned_at),
    createdAt: toIso(loan.created_at),
  };
}

export function publicLedgerRow(row: LedgerRow) {
  return {
    id: row.id,
    transferId: row.transferId,
    kind: row.kind,
    account: row.account,
    amount: money(row.amount),
    memo: row.memo,
    loanId: row.loanId,
    createdAt: toIso(row.createdAt),
  };
}

/** Attaches the people and tool involved so the client needs one round trip. */
export function loanWithContext(db: Db, loan: LoanRow, nowMs = Date.now()) {
  const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(loan.tool_id) as ToolRow | undefined;
  const owner = db.prepare('SELECT * FROM members WHERE id = ?').get(loan.owner_id) as MemberRow | undefined;
  const borrower = db.prepare('SELECT * FROM members WHERE id = ?').get(loan.borrower_id) as
    | MemberRow
    | undefined;
  return {
    ...publicLoan(db, loan, nowMs),
    tool: tool ? publicTool(tool) : null,
    owner: owner ? publicMember(owner, reputationFor(db, owner.id)) : null,
    borrower: borrower ? publicMember(borrower, reputationFor(db, borrower.id)) : null,
  };
}
