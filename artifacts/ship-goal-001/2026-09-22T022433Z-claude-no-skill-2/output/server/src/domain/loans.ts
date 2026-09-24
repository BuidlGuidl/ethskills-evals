import type { Db } from '../db/index.js';
import { tx } from '../db/index.js';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { DAY_MS, addDays, lateDays } from '../lib/time.js';
import * as ledger from './ledger.js';
import { requireTool, setToolStatus } from './tools.js';

export type LoanStatus = 'requested' | 'approved' | 'active' | 'returned' | 'declined' | 'cancelled';

export interface LoanRow {
  id: string;
  tool_id: string;
  owner_id: string;
  borrower_id: string;
  status: LoanStatus;
  requested_days: number;
  message: string;
  deposit_micros: number;
  late_fee_micros: number;
  late_fees_charged: number;
  late_days_charged: number;
  late_days: number;
  deposit_exhausted: number;
  due_at: number | null;
  handed_over_at: number | null;
  returned_at: number | null;
  decided_at: number | null;
  decline_reason: string | null;
  closed_at: number | null;
  created_at: number;
  updated_at: number;
}

/** A request that nobody answers stops holding the borrower's money after this. */
export const REQUEST_TTL_DAYS = 7;

export function getLoan(db: Db, id: string): LoanRow | undefined {
  return db.prepare('SELECT * FROM loans WHERE id = ?').get(id) as LoanRow | undefined;
}

export function requireLoan(db: Db, id: string): LoanRow {
  const loan = getLoan(db, id);
  if (!loan) throw ApiError.notFound('No such loan');
  return loan;
}

function touch(db: Db, loanId: string, fields: Partial<Record<keyof LoanRow, unknown>>): LoanRow {
  const keys = Object.keys(fields);
  const sets = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE loans SET ${sets}, updated_at = @updated_at WHERE id = @id`).run({
    ...fields,
    id: loanId,
    updated_at: Date.now(),
  });
  return requireLoan(db, loanId);
}

// --- requesting ------------------------------------------------------------

export interface RequestLoanInput {
  toolId: string;
  borrowerId: string;
  days: number;
  message?: string;
  now?: number;
}

/**
 * Creates a request and moves the deposit into escrow straight away, so an
 * owner approving a request knows the money is really there. The hold is
 * released if the request is declined, cancelled or expires.
 */
export function requestLoan(db: Db, input: RequestLoanInput): LoanRow {
  const now = input.now ?? Date.now();
  return tx(db, () => {
    const tool = requireTool(db, input.toolId);
    if (tool.owner_id === input.borrowerId) {
      throw ApiError.badRequest('own_tool', 'That is your own tool');
    }
    if (tool.status === 'retired') {
      throw ApiError.conflict('tool_retired', 'That tool is no longer in the library');
    }
    if (tool.status === 'lent_out') {
      throw ApiError.conflict('tool_lent_out', 'That tool is already out on loan');
    }
    if (input.days < 1 || input.days > tool.max_loan_days) {
      throw ApiError.badRequest(
        'invalid_days',
        `${tool.name} can be borrowed for 1-${tool.max_loan_days} days`,
      );
    }

    const duplicate = db
      .prepare(`SELECT id FROM loans WHERE tool_id = ? AND borrower_id = ? AND status = 'requested'`)
      .get(input.toolId, input.borrowerId) as { id: string } | undefined;
    if (duplicate) {
      throw ApiError.conflict('already_requested', 'You already have a pending request for this tool', {
        loanId: duplicate.id,
      });
    }

    const overdue = overdueLoansFor(db, input.borrowerId, now);
    if (overdue.length > 0) {
      throw ApiError.conflict(
        'borrower_overdue',
        'You have an overdue tool out. Return it before borrowing anything else.',
        { loanIds: overdue.map((l) => l.id) },
      );
    }

    const loan: LoanRow = {
      id: newId('loan'),
      tool_id: tool.id,
      owner_id: tool.owner_id,
      borrower_id: input.borrowerId,
      status: 'requested',
      requested_days: input.days,
      message: (input.message ?? '').trim(),
      deposit_micros: tool.deposit_micros,
      late_fee_micros: tool.late_fee_micros,
      late_fees_charged: 0,
      late_days_charged: 0,
      late_days: 0,
      deposit_exhausted: 0,
      due_at: null,
      handed_over_at: null,
      returned_at: null,
      decided_at: null,
      decline_reason: null,
      closed_at: null,
      created_at: now,
      updated_at: now,
    };
    db.prepare(
      `INSERT INTO loans (id, tool_id, owner_id, borrower_id, status, requested_days, message,
                          deposit_micros, late_fee_micros, late_fees_charged, late_days_charged, late_days,
                          deposit_exhausted, due_at, handed_over_at, returned_at, decided_at, decline_reason,
                          closed_at, created_at, updated_at)
       VALUES (@id, @tool_id, @owner_id, @borrower_id, @status, @requested_days, @message,
               @deposit_micros, @late_fee_micros, @late_fees_charged, @late_days_charged, @late_days,
               @deposit_exhausted, @due_at, @handed_over_at, @returned_at, @decided_at, @decline_reason,
               @closed_at, @created_at, @updated_at)`,
    ).run(loan);

    // Throws insufficient_funds (409) and rolls back the whole request if the
    // borrower cannot cover the deposit.
    ledger.holdDeposit(db, loan.id, loan.borrower_id, loan.deposit_micros, now);
    return loan;
  });
}

export function overdueLoansFor(db: Db, borrowerId: string, now = Date.now()): LoanRow[] {
  return db
    .prepare(
      `SELECT * FROM loans
        WHERE borrower_id = ? AND status = 'active' AND due_at IS NOT NULL AND due_at < ?`,
    )
    .all(borrowerId, now) as LoanRow[];
}

// --- owner decisions -------------------------------------------------------

export function approveLoan(db: Db, loanId: string, actorId: string, now = Date.now()): LoanRow {
  return tx(db, () => {
    const loan = requireLoan(db, loanId);
    if (loan.owner_id !== actorId) throw ApiError.forbidden('Only the owner can approve this request');
    if (loan.status !== 'requested') {
      throw ApiError.conflict('bad_state', `This request is already ${loan.status}`);
    }
    const tool = requireTool(db, loan.tool_id);
    if (tool.status !== 'available') {
      throw ApiError.conflict('tool_unavailable', 'That tool is not available right now');
    }

    // The tool can only go to one person: everyone else gets their money back now.
    const others = db
      .prepare(`SELECT * FROM loans WHERE tool_id = ? AND status = 'requested' AND id != ?`)
      .all(loan.tool_id, loan.id) as LoanRow[];
    for (const other of others) {
      declineRequestInternal(db, other, 'The owner lent this tool to someone else', now);
    }

    setToolStatus(db, tool.id, 'lent_out');
    return touch(db, loan.id, { status: 'approved', decided_at: now });
  });
}

function declineRequestInternal(db: Db, loan: LoanRow, reason: string, now: number): LoanRow {
  // Release whatever is actually in escrow rather than the nominal deposit, so
  // this stays correct for free loans and for any future partial holds.
  const held = ledger.loanEscrowBalance(db, loan.id);
  ledger.releaseDeposit(db, loan.id, loan.borrower_id, held, 'declined', now);
  return touch(db, loan.id, {
    status: 'declined',
    decided_at: now,
    closed_at: now,
    decline_reason: reason,
  });
}

/**
 * The owner saying no. Also covers an approved loan where the pickup never
 * happened - otherwise the tool would stay flagged as lent out forever.
 */
export function declineLoan(db: Db, loanId: string, actorId: string, reason = '', now = Date.now()): LoanRow {
  return tx(db, () => {
    const loan = requireLoan(db, loanId);
    if (loan.owner_id !== actorId) throw ApiError.forbidden('Only the owner can decline this request');
    if (loan.status !== 'requested' && loan.status !== 'approved') {
      throw ApiError.conflict('bad_state', `This request is already ${loan.status}`);
    }
    const updated = declineRequestInternal(db, loan, reason.trim(), now);
    if (loan.status === 'approved') setToolStatus(db, loan.tool_id, 'available');
    return updated;
  });
}

/** The borrower backing out, before the tool has changed hands. */
export function cancelLoan(db: Db, loanId: string, actorId: string, now = Date.now()): LoanRow {
  return tx(db, () => {
    const loan = requireLoan(db, loanId);
    if (loan.borrower_id !== actorId) throw ApiError.forbidden('Only the borrower can cancel this request');
    if (loan.status !== 'requested' && loan.status !== 'approved') {
      throw ApiError.conflict('bad_state', `This loan is already ${loan.status}`);
    }
    const held = ledger.loanEscrowBalance(db, loan.id);
    ledger.releaseDeposit(db, loan.id, loan.borrower_id, held, 'cancelled', now);
    if (loan.status === 'approved') setToolStatus(db, loan.tool_id, 'available');
    return touch(db, loan.id, { status: 'cancelled', decided_at: now, closed_at: now });
  });
}

// --- handover and return ---------------------------------------------------

/**
 * The owner confirms the tool has physically changed hands. The clock starts
 * here rather than at approval, so a slow pickup does not eat the borrower's
 * days (or trigger late fees for a tool they never received).
 */
export function handOver(db: Db, loanId: string, actorId: string, now = Date.now()): LoanRow {
  return tx(db, () => {
    const loan = requireLoan(db, loanId);
    if (loan.owner_id !== actorId) throw ApiError.forbidden('Only the owner can confirm handover');
    if (loan.status !== 'approved') {
      throw ApiError.conflict('bad_state', `Cannot hand over a loan that is ${loan.status}`);
    }
    setToolStatus(db, loan.tool_id, 'lent_out');
    return touch(db, loan.id, {
      status: 'active',
      handed_over_at: now,
      due_at: addDays(now, loan.requested_days),
    });
  });
}

/**
 * The owner confirms the tool is back. Late fees are settled up to this moment
 * and whatever is left of the deposit goes back to the borrower.
 */
export function confirmReturn(db: Db, loanId: string, actorId: string, now = Date.now()): LoanRow {
  return tx(db, () => {
    let loan = requireLoan(db, loanId);
    const isAdmin = !!(
      db.prepare('SELECT is_admin FROM members WHERE id = ?').get(actorId) as { is_admin: number } | undefined
    )?.is_admin;
    if (loan.owner_id !== actorId && !isAdmin) {
      throw ApiError.forbidden('Only the owner can confirm a return');
    }
    if (loan.status !== 'active') {
      throw ApiError.conflict('bad_state', `Cannot return a loan that is ${loan.status}`);
    }

    loan = accrueLoan(db, loan, now);

    ledger.releaseDeposit(db, loan.id, loan.borrower_id, ledger.loanEscrowBalance(db, loan.id), 'settled', now);
    setToolStatus(db, loan.tool_id, 'available');
    return touch(db, loan.id, {
      status: 'returned',
      returned_at: now,
      closed_at: now,
      late_days: lateDays(now, loan.due_at!, config.lateGraceHours),
    });
  });
}

// --- late fees -------------------------------------------------------------

export interface AccrualSummary {
  loansChecked: number;
  loansCharged: number;
  microsCharged: number;
  depositsExhausted: number;
}

/**
 * Charges one fee per late day, one ledger transfer per day, up to what is
 * left of the deposit. Every transfer is keyed by (loan, day) so running this
 * twice - or catching up after downtime - charges each day exactly once.
 */
export function accrueLoan(db: Db, loan: LoanRow, now = Date.now()): LoanRow {
  if (loan.status !== 'active' || loan.due_at === null || loan.late_fee_micros <= 0) return loan;

  const owedDays = lateDays(now, loan.due_at, config.lateGraceHours);
  if (owedDays <= loan.late_days_charged) return loan;

  return tx(db, () => {
    let charged = loan.late_days_charged;
    let total = loan.late_fees_charged;
    let exhausted = false;

    for (let day = charged + 1; day <= owedDays; day++) {
      const remaining = ledger.loanEscrowBalance(db, loan.id);
      if (remaining <= 0) {
        exhausted = true;
        break;
      }
      const amount = Math.min(loan.late_fee_micros, remaining);
      // Timestamp the charge at the day it covers, not at sweep time, so the
      // ledger reads correctly even if the worker was down for a while.
      const at = Math.min(now, loan.due_at! + config.lateGraceHours * 60 * 60 * 1000 + day * DAY_MS);
      ledger.chargeLateFee(db, loan.id, loan.borrower_id, loan.owner_id, amount, day, at);
      charged = day;
      total += amount;
      if (amount < loan.late_fee_micros || ledger.loanEscrowBalance(db, loan.id) <= 0) {
        exhausted = true;
        break;
      }
    }

    return touch(db, loan.id, {
      late_days_charged: charged,
      late_fees_charged: total,
      deposit_exhausted: exhausted ? 1 : loan.deposit_exhausted,
    });
  });
}

/** Sweeps every overdue active loan. Safe to run on a timer and by hand. */
export function accrueAllDue(db: Db, now = Date.now()): AccrualSummary {
  const loans = db
    .prepare(
      `SELECT * FROM loans
        WHERE status = 'active' AND due_at IS NOT NULL AND due_at < ? AND late_fee_micros > 0`,
    )
    .all(now) as LoanRow[];

  const summary: AccrualSummary = {
    loansChecked: loans.length,
    loansCharged: 0,
    microsCharged: 0,
    depositsExhausted: 0,
  };
  for (const loan of loans) {
    const after = accrueLoan(db, loan, now);
    const delta = after.late_fees_charged - loan.late_fees_charged;
    if (delta > 0) {
      summary.loansCharged++;
      summary.microsCharged += delta;
    }
    if (!loan.deposit_exhausted && after.deposit_exhausted) summary.depositsExhausted++;
  }
  return summary;
}

/** Releases deposits held by requests nobody ever answered. */
export function expireStaleRequests(db: Db, now = Date.now()): number {
  const cutoff = now - REQUEST_TTL_DAYS * DAY_MS;
  const stale = db
    .prepare(`SELECT * FROM loans WHERE status = 'requested' AND created_at < ?`)
    .all(cutoff) as LoanRow[];
  for (const loan of stale) {
    tx(db, () =>
      declineRequestInternal(db, loan, `No answer within ${REQUEST_TTL_DAYS} days`, now),
    );
  }
  return stale.length;
}

// --- reads -----------------------------------------------------------------

export interface ListLoansQuery {
  memberId: string;
  role: 'borrower' | 'owner' | 'any';
  statuses?: LoanStatus[];
  limit?: number;
}

export function listLoans(db: Db, query: ListLoansQuery): LoanRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.role === 'borrower') {
    where.push('borrower_id = ?');
    params.push(query.memberId);
  } else if (query.role === 'owner') {
    where.push('owner_id = ?');
    params.push(query.memberId);
  } else {
    where.push('(borrower_id = ? OR owner_id = ?)');
    params.push(query.memberId, query.memberId);
  }
  if (query.statuses?.length) {
    where.push(`status IN (${query.statuses.map(() => '?').join(', ')})`);
    params.push(...query.statuses);
  }
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 200);
  return db
    .prepare(
      `SELECT * FROM loans WHERE ${where.join(' AND ')}
        ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'approved' THEN 1 WHEN 'requested' THEN 2 ELSE 3 END,
                 COALESCE(due_at, created_at) ASC
        LIMIT ?`,
    )
    .all(...params, limit) as LoanRow[];
}

export function loanEscrow(db: Db, loanId: string): number {
  return ledger.loanEscrowBalance(db, loanId);
}
