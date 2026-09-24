import { transaction } from '../db.js';
import { assertDay, daysBetween, formatDay, nowIso, today as todayIn } from '../domain/dates.js';
import { fromStorage, formatUsdc, toStorage } from '../domain/money.js';
import { lateDays, settle } from '../domain/fees.js';
import { getTool, ownerRecords } from './tools.js';
import { ValidationError } from './members.js';
import { notify } from './notices.js';
import { config } from '../config.js';

// Loan lifecycle:
//
//   requested --approve--> active --confirm return--> closed
//       |  \                                             ^
//       |   `--decline--> declined                       |
//       |                                          deposit split here
//       `--cancel----> cancelled
//       `--(start day passes)--> expired
//
// The deposit is held in escrow the moment a request is made, not when it is
// approved. An owner deciding whether to lend out their good drill should be
// looking at a request whose money is already set aside; and a member cannot
// spray requests across ten tools with one deposit's worth of USDC.
//
// Every state change that touches money runs in one transaction with the
// escrow call, so a loan is never approved with its deposit unheld.

export const OPEN_STATUSES = ['requested', 'active'];

export function requestLoan(handle, escrow, { toolId, borrowerId, startDay, dueDay, note = '' }, now = new Date()) {
  const today = todayIn(config.timezone, now);
  const tool = getTool(handle, toolId);
  if (!tool || tool.status !== 'listed') throw new ValidationError('That tool is not available right now.');
  if (tool.owner_id === borrowerId) throw new ValidationError('That is your own tool.');

  validateDay(startDay, 'start date');
  validateDay(dueDay, 'return date');
  if (daysBetween(today, startDay) < 0) throw new ValidationError('The start date is in the past.');
  if (daysBetween(startDay, dueDay) < 0) throw new ValidationError('The return date is before the start date.');
  const days = daysBetween(startDay, dueDay) + 1;
  if (days > tool.max_days) {
    throw new ValidationError(`${tool.name} can be borrowed for at most ${tool.max_days} days.`);
  }

  const mine = handle
    .prepare(
      `SELECT id FROM loans WHERE tool_id = ? AND borrower_id = ? AND status IN ('requested', 'active')`,
    )
    .get(toolId, borrowerId);
  if (mine) throw new ValidationError('You already have an open request for this tool.');

  const clash = overlappingLoans(handle, toolId, startDay, dueDay, ['active']);
  if (clash.length > 0) {
    throw new ValidationError(
      `${tool.name} is already out until ${formatDay(clash[0].due_day)}. Try dates after that.`,
    );
  }

  return transaction(handle, () => {
    const info = handle
      .prepare(
        `INSERT INTO loans (tool_id, borrower_id, owner_id, status, note, start_day, due_day,
                            deposit_amount, daily_late_fee, requested_at)
         VALUES (?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        toolId,
        borrowerId,
        tool.owner_id,
        String(note ?? '').trim().slice(0, 1000),
        startDay,
        dueDay,
        toStorage(tool.depositAmount),
        toStorage(tool.dailyLateFee),
        nowIso(),
      );
    const loanId = Number(info.lastInsertRowid);
    try {
      escrow.hold(handle, { loanId, memberId: borrowerId, amount: tool.depositAmount });
    } catch (error) {
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new ValidationError(
          `You need ${formatUsdc(tool.depositAmount)} USDC available to hold as a deposit. Add funds and try again.`,
        );
      }
      throw error;
    }
    notify(handle, {
      memberId: tool.owner_id,
      loanId,
      kind: 'request_received',
      body: `A neighbour asked to borrow your ${tool.name} from ${formatDay(startDay)} to ${formatDay(dueDay)}.`,
    });
    return getLoan(handle, loanId);
  });
}

export function approveLoan(handle, escrow, loanId, ownerId) {
  return transaction(handle, () => {
    const loan = requireLoan(handle, loanId, { status: 'requested', ownerId });
    const clash = overlappingLoans(handle, loan.tool_id, loan.start_day, loan.due_day, ['active']);
    if (clash.length > 0) throw new ValidationError('This tool is already out over those dates.');

    handle
      .prepare(`UPDATE loans SET status = 'active', decided_at = ? WHERE id = ?`)
      .run(nowIso(), loanId);
    notify(handle, {
      memberId: loan.borrower_id,
      loanId,
      kind: 'request_approved',
      body: `${loan.owner_name} said yes to the ${loan.tool_name}. It is due back ${formatDay(loan.due_day)}; after that ${formatUsdc(loan.dailyLateFee)} USDC a day comes out of your deposit.`,
    });

    // Anyone else asking for the same tool over the same dates cannot have it
    // now, so release their deposits instead of leaving them tied up.
    for (const other of overlappingLoans(handle, loan.tool_id, loan.start_day, loan.due_day, ['requested'])) {
      if (other.id === loanId) continue;
      closeRequest(handle, escrow, getLoan(handle, other.id), 'declined', 'The tool was lent to someone else for those dates.');
    }
    return getLoan(handle, loanId);
  });
}

export function declineLoan(handle, escrow, loanId, ownerId, reason = '') {
  return transaction(handle, () => {
    const loan = requireLoan(handle, loanId, { status: 'requested', ownerId });
    return closeRequest(handle, escrow, loan, 'declined', String(reason ?? '').trim().slice(0, 500));
  });
}

export function cancelRequest(handle, escrow, loanId, borrowerId) {
  return transaction(handle, () => {
    const loan = requireLoan(handle, loanId, { status: 'requested', borrowerId });
    return closeRequest(handle, escrow, loan, 'cancelled', '');
  });
}

/**
 * The owner confirms the tool is back. This is the only place a late fee is
 * charged, and it is charged against the day the tool actually came back --
 * the owner may record an earlier day than today (a tool returned Saturday and
 * confirmed Monday is not two days later).
 */
export function confirmReturn(handle, escrow, loanId, ownerId, returnedDay, now = new Date()) {
  const today = todayIn(config.timezone, now);
  return transaction(handle, () => {
    const loan = requireLoan(handle, loanId, { status: 'active', ownerId });
    const day = returnedDay ? validateDay(returnedDay, 'return date') : today;
    if (daysBetween(day, today) < 0) throw new ValidationError('That return date is in the future.');
    if (daysBetween(loan.start_day, day) < 0) {
      throw new ValidationError('The tool cannot come back before the loan started.');
    }

    const result = settle(loan.depositAmount, loan.dailyLateFee, lateDays(loan.due_day, day));
    const { fee, refund } = escrow.capture(handle, loanId, { fee: result.fee, ownerId: loan.owner_id });

    handle
      .prepare(
        `UPDATE loans SET status = 'closed', returned_day = ?, late_days = ?,
                fee_charged = ?, refund_amount = ?, closed_at = ?
          WHERE id = ?`,
      )
      .run(day, result.lateDays, toStorage(fee), toStorage(refund), nowIso(), loanId);

    notify(handle, {
      memberId: loan.borrower_id,
      loanId,
      kind: 'loan_closed',
      body:
        result.lateDays === 0
          ? `${loan.owner_name} confirmed the ${loan.tool_name} is back. Your ${formatUsdc(refund)} USDC deposit has been returned.`
          : `${loan.owner_name} confirmed the ${loan.tool_name} came back ${result.lateDays} day${result.lateDays === 1 ? '' : 's'} late. ${formatUsdc(fee)} USDC of your deposit went to them${result.forfeited ? ' (the whole deposit)' : ''}; ${formatUsdc(refund)} USDC came back to you.`,
    });
    if (fee > 0n) {
      notify(handle, {
        memberId: loan.owner_id,
        loanId,
        kind: 'fee_collected',
        body: `${formatUsdc(fee)} USDC in late fees for the ${loan.tool_name} is in your balance.`,
      });
    }
    return getLoan(handle, loanId);
  });
}

/** Release the hold and close a request that never became a loan. */
function closeRequest(handle, escrow, loan, status, reason) {
  escrow.release(handle, loan.id);
  handle
    .prepare('UPDATE loans SET status = ?, decided_at = ?, decline_reason = ?, closed_at = ? WHERE id = ?')
    .run(status, nowIso(), reason, nowIso(), loan.id);
  if (status !== 'cancelled') {
    notify(handle, {
      memberId: loan.borrower_id,
      loanId: loan.id,
      kind: `request_${status}`,
      body:
        status === 'declined'
          ? `Your request for the ${loan.tool_name} was declined${reason ? `: ${reason}` : '.'} Your ${formatUsdc(loan.depositAmount)} USDC deposit is back in your balance.`
          : `Your request for the ${loan.tool_name} expired because the start date passed. Your deposit is back in your balance.`,
    });
  }
  return getLoan(handle, loan.id);
}

/** Requests whose start day has gone by without the owner deciding. */
export function expireStaleRequests(handle, escrow, now = new Date()) {
  const today = todayIn(config.timezone, now);
  const stale = handle
    .prepare(`SELECT id FROM loans WHERE status = 'requested' AND start_day < ?`)
    .all(today);
  let expired = 0;
  for (const { id } of stale) {
    transaction(handle, () => {
      const loan = getLoan(handle, id);
      if (loan.status !== 'requested') return;
      closeRequest(handle, escrow, loan, 'expired', '');
      expired += 1;
    });
  }
  return expired;
}

// --- queries --------------------------------------------------------------

const LOAN_SELECT = `
  SELECT l.*, t.name AS tool_name, t.photo AS tool_photo,
         o.name AS owner_name, b.name AS borrower_name, b.unit AS borrower_unit
    FROM loans l
    JOIN tools t   ON t.id = l.tool_id
    JOIN members o ON o.id = l.owner_id
    JOIN members b ON b.id = l.borrower_id`;

export function getLoan(handle, loanId) {
  const row = handle.prepare(`${LOAN_SELECT} WHERE l.id = ?`).get(loanId);
  return row ? decorate(row) : null;
}

/** The owner's queue: who is asking, best track record first. */
export function pendingRequestsFor(handle, ownerId) {
  const rows = handle
    .prepare(`${LOAN_SELECT} WHERE l.owner_id = ? AND l.status = 'requested'`)
    .all(ownerId)
    .map(decorate);
  const records = ownerRecords(handle);
  return rows
    .map((loan) => ({ ...loan, borrowerRecord: records.get(loan.borrower_id) }))
    .sort((a, b) => b.borrowerRecord.score - a.borrowerRecord.score || a.start_day.localeCompare(b.start_day));
}

export function loansBorrowedBy(handle, borrowerId, statuses = null) {
  return query(handle, 'l.borrower_id = ?', borrowerId, statuses);
}

export function loansLentBy(handle, ownerId, statuses = null) {
  return query(handle, 'l.owner_id = ?', ownerId, statuses);
}

export function loansForTool(handle, toolId) {
  return query(handle, 'l.tool_id = ?', toolId, null);
}

function query(handle, where, param, statuses) {
  const filter = statuses ? ` AND l.status IN (${statuses.map(() => '?').join(',')})` : '';
  return handle
    .prepare(`${LOAN_SELECT} WHERE ${where}${filter} ORDER BY l.due_day DESC, l.id DESC`)
    .all(param, ...(statuses ?? []))
    .map(decorate);
}

/** Active loans already past their due day, most overdue first. */
export function overdueLoans(handle, now = new Date()) {
  const today = todayIn(config.timezone, now);
  return handle
    .prepare(`${LOAN_SELECT} WHERE l.status = 'active' AND l.due_day < ? ORDER BY l.due_day`)
    .all(today)
    .map(decorate);
}

export function overlappingLoans(handle, toolId, startDay, dueDay, statuses) {
  return handle
    .prepare(
      `SELECT * FROM loans
        WHERE tool_id = ? AND status IN (${statuses.map(() => '?').join(',')})
          AND start_day <= ? AND due_day >= ?
        ORDER BY due_day DESC`,
    )
    .all(toolId, ...statuses, dueDay, startDay);
}

function requireLoan(handle, loanId, { status, ownerId, borrowerId }) {
  const loan = getLoan(handle, loanId);
  if (!loan) throw new ValidationError('That loan no longer exists.');
  if (ownerId !== undefined && loan.owner_id !== ownerId) throw new ValidationError('That is not your loan to change.');
  if (borrowerId !== undefined && loan.borrower_id !== borrowerId) throw new ValidationError('That is not your request.');
  if (status && loan.status !== status) throw new ValidationError(`This request is already ${loan.status}.`);
  return loan;
}

function validateDay(value, label) {
  try {
    return assertDay(value, label);
  } catch {
    throw new ValidationError(`Pick a valid ${label}.`);
  }
}

function decorate(row) {
  return {
    ...row,
    depositAmount: fromStorage(row.deposit_amount),
    dailyLateFee: fromStorage(row.daily_late_fee),
    feeCharged: row.fee_charged == null ? null : fromStorage(row.fee_charged),
    refundAmount: row.refund_amount == null ? null : fromStorage(row.refund_amount),
    dueDay: row.due_day,
  };
}
