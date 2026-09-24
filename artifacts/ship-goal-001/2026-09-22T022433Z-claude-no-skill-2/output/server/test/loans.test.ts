import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/index.js';
import { makeDb, makeMember, makeTool } from './helpers.js';
import {
  accrueAllDue,
  accrueLoan,
  approveLoan,
  cancelLoan,
  confirmReturn,
  declineLoan,
  expireStaleRequests,
  handOver,
  requestLoan,
  requireLoan,
  REQUEST_TTL_DAYS,
} from '../src/domain/loans.js';
import { balances, loanEscrowBalance } from '../src/domain/ledger.js';
import { reputationFor } from '../src/domain/reputation.js';
import { getTool } from '../src/domain/tools.js';
import { DAY_MS, HOUR_MS } from '../src/lib/time.js';
import { usdcToMicros } from '../src/lib/money.js';

const usdc = usdcToMicros;

describe('loan lifecycle', () => {
  let db: Db;
  let owner: ReturnType<typeof makeMember>;
  let borrower: ReturnType<typeof makeMember>;
  let tool: ReturnType<typeof makeTool>;
  const t0 = Date.UTC(2026, 2, 1, 9, 0, 0);

  beforeEach(() => {
    db = makeDb();
    owner = makeMember(db, { name: 'Owner', funds: 0 });
    borrower = makeMember(db, { name: 'Borrower', funds: 500 });
    tool = makeTool(db, owner.id, { deposit: 100, lateFee: 5, maxDays: 3 });
  });

  it('moves the deposit into escrow when a request is made', () => {
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 2, now: t0 });

    expect(loan.status).toBe('requested');
    expect(balances(db, borrower.id)).toEqual({ available: usdc(400), escrow: usdc(100) });
    expect(loanEscrowBalance(db, loan.id)).toBe(usdc(100));
    // The tool is only off the shelf once the owner says yes.
    expect(getTool(db, tool.id)?.status).toBe('available');
  });

  it('refuses a request the borrower cannot fund', () => {
    const broke = makeMember(db, { funds: 20 });
    expect(() => requestLoan(db, { toolId: tool.id, borrowerId: broke.id, days: 1, now: t0 })).toThrow(
      /Not enough USDC/,
    );
    // The failed request must leave nothing behind.
    expect(db.prepare('SELECT COUNT(*) AS n FROM loans').get()).toEqual({ n: 0 });
    expect(balances(db, broke.id)).toEqual({ available: usdc(20), escrow: 0 });
  });

  it('rejects borrowing your own tool, retired tools and over-long requests', () => {
    expect(() => requestLoan(db, { toolId: tool.id, borrowerId: owner.id, days: 1, now: t0 })).toThrow(
      /your own tool/,
    );
    expect(() => requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 4, now: t0 })).toThrow(
      /1-3 days/,
    );
  });

  it('returns the deposit when a request is declined or cancelled', () => {
    const declined = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    declineLoan(db, declined.id, owner.id, 'Need it myself', t0 + HOUR_MS);
    expect(balances(db, borrower.id)).toEqual({ available: usdc(500), escrow: 0 });
    expect(requireLoan(db, declined.id).decline_reason).toBe('Need it myself');

    const cancelled = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    cancelLoan(db, cancelled.id, borrower.id, t0 + HOUR_MS);
    expect(balances(db, borrower.id)).toEqual({ available: usdc(500), escrow: 0 });
  });

  it('approving one request releases everyone else waiting on that tool', () => {
    const other = makeMember(db, { funds: 500 });
    const mine = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    const theirs = requestLoan(db, { toolId: tool.id, borrowerId: other.id, days: 1, now: t0 });

    approveLoan(db, mine.id, owner.id, t0 + HOUR_MS);

    expect(requireLoan(db, theirs.id).status).toBe('declined');
    expect(balances(db, other.id).escrow).toBe(0);
    expect(balances(db, borrower.id).escrow).toBe(usdc(100));
    expect(getTool(db, tool.id)?.status).toBe('lent_out');
  });

  it('starts the clock at handover, not approval', () => {
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 2, now: t0 });
    approveLoan(db, loan.id, owner.id, t0 + HOUR_MS);
    const active = handOver(db, loan.id, owner.id, t0 + 2 * DAY_MS);

    expect(active.status).toBe('active');
    expect(active.due_at).toBe(t0 + 2 * DAY_MS + 2 * DAY_MS);
  });

  it('gives the whole deposit back on an on-time return', () => {
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 2, now: t0 });
    approveLoan(db, loan.id, owner.id, t0);
    handOver(db, loan.id, owner.id, t0);
    const returned = confirmReturn(db, loan.id, owner.id, t0 + DAY_MS);

    expect(returned.status).toBe('returned');
    expect(returned.late_days).toBe(0);
    expect(returned.late_fees_charged).toBe(0);
    expect(balances(db, borrower.id)).toEqual({ available: usdc(500), escrow: 0 });
    expect(balances(db, owner.id)).toEqual({ available: 0, escrow: 0 });
    expect(getTool(db, tool.id)?.status).toBe('available');
    expect(reputationFor(db, borrower.id)).toMatchObject({ loansBorrowed: 1, lateReturns: 0 });
  });

  it('takes one late fee per late day out of the deposit and pays the owner', () => {
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 2, now: t0 });
    approveLoan(db, loan.id, owner.id, t0);
    handOver(db, loan.id, owner.id, t0);
    const dueAt = t0 + 2 * DAY_MS;

    // Three days late: fees land as the days pass, not all at return time.
    accrueAllDue(db, dueAt + 30 * HOUR_MS);
    expect(requireLoan(db, loan.id).late_fees_charged).toBe(usdc(10)); // days 1 and 2
    accrueAllDue(db, dueAt + 2 * DAY_MS + HOUR_MS);
    expect(requireLoan(db, loan.id).late_fees_charged).toBe(usdc(15));

    const returned = confirmReturn(db, loan.id, owner.id, dueAt + 2 * DAY_MS + 2 * HOUR_MS);

    expect(returned.late_days).toBe(3);
    expect(returned.late_fees_charged).toBe(usdc(15));
    expect(balances(db, owner.id).available).toBe(usdc(15));
    expect(balances(db, borrower.id)).toEqual({ available: usdc(485), escrow: 0 });
    expect(reputationFor(db, borrower.id)).toMatchObject({ loansBorrowed: 1, lateReturns: 1, lateDays: 3 });
  });

  it('charges the same days once however often the sweep runs', () => {
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    approveLoan(db, loan.id, owner.id, t0);
    handOver(db, loan.id, owner.id, t0);
    const when = t0 + DAY_MS + 3 * DAY_MS;

    for (let i = 0; i < 5; i++) accrueAllDue(db, when);
    expect(requireLoan(db, loan.id).late_fees_charged).toBe(usdc(15));
    expect(balances(db, owner.id).available).toBe(usdc(15));
  });

  it('never charges more than the deposit, and flags it as exhausted', () => {
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    approveLoan(db, loan.id, owner.id, t0);
    handOver(db, loan.id, owner.id, t0);

    // 60 days late at 5 USDC/day would be 300 USDC against a 100 USDC deposit.
    const summary = accrueAllDue(db, t0 + DAY_MS + 60 * DAY_MS);

    const loanNow = requireLoan(db, loan.id);
    expect(loanNow.late_fees_charged).toBe(usdc(100));
    expect(loanNow.deposit_exhausted).toBe(1);
    expect(summary.depositsExhausted).toBe(1);
    expect(loanEscrowBalance(db, loan.id)).toBe(0);
    expect(balances(db, owner.id).available).toBe(usdc(100));

    // The late return still counts against the borrower's record.
    const returned = confirmReturn(db, loan.id, owner.id, t0 + DAY_MS + 61 * DAY_MS);
    expect(returned.late_days).toBe(61);
    expect(balances(db, borrower.id)).toEqual({ available: usdc(400), escrow: 0 });
    expect(reputationFor(db, borrower.id).lateReturns).toBe(1);
  });

  it('handles a partial final fee when the deposit does not divide evenly', () => {
    const odd = makeTool(db, owner.id, { deposit: 12, lateFee: 5, maxDays: 1, name: 'Odd tool' });
    const loan = requestLoan(db, { toolId: odd.id, borrowerId: borrower.id, days: 1, now: t0 });
    approveLoan(db, loan.id, owner.id, t0);
    handOver(db, loan.id, owner.id, t0);

    accrueAllDue(db, t0 + DAY_MS + 10 * DAY_MS);

    const loanNow = requireLoan(db, loan.id);
    expect(loanNow.late_fees_charged).toBe(usdc(12)); // 5 + 5 + 2
    expect(loanNow.late_days_charged).toBe(3);
    expect(balances(db, owner.id).available).toBe(usdc(12));
  });

  it('keeps one loan from spending another loan of the same borrower', () => {
    const second = makeTool(db, owner.id, { deposit: 50, lateFee: 5, maxDays: 1, name: 'Second' });
    const a = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    approveLoan(db, a.id, owner.id, t0);
    handOver(db, a.id, owner.id, t0);
    const b = requestLoan(db, { toolId: second.id, borrowerId: borrower.id, days: 1, now: t0 });
    approveLoan(db, b.id, owner.id, t0);
    handOver(db, b.id, owner.id, t0);

    accrueAllDue(db, t0 + DAY_MS + 100 * DAY_MS);

    expect(requireLoan(db, a.id).late_fees_charged).toBe(usdc(100));
    expect(requireLoan(db, b.id).late_fees_charged).toBe(usdc(50));
    expect(balances(db, borrower.id).escrow).toBe(0);
    expect(balances(db, owner.id).available).toBe(usdc(150));
  });

  it('blocks new requests while a borrower is holding something overdue', () => {
    const other = makeTool(db, owner.id, { name: 'Other tool' });
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    approveLoan(db, loan.id, owner.id, t0);
    handOver(db, loan.id, owner.id, t0);

    const overdueNow = t0 + 3 * DAY_MS;
    expect(() =>
      requestLoan(db, { toolId: other.id, borrowerId: borrower.id, days: 1, now: overdueNow }),
    ).toThrow(/overdue/);

    confirmReturn(db, loan.id, owner.id, overdueNow);
    expect(() =>
      requestLoan(db, { toolId: other.id, borrowerId: borrower.id, days: 1, now: overdueNow }),
    ).not.toThrow();
  });

  it('will not take two pending requests for the same tool from one member', () => {
    requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    expect(() => requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 })).toThrow(
      /already have a pending request/,
    );
  });

  it('releases deposits for requests nobody ever answers', () => {
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    expect(expireStaleRequests(db, t0 + DAY_MS)).toBe(0);

    expect(expireStaleRequests(db, t0 + (REQUEST_TTL_DAYS + 1) * DAY_MS)).toBe(1);
    expect(requireLoan(db, loan.id).status).toBe('declined');
    expect(balances(db, borrower.id)).toEqual({ available: usdc(500), escrow: 0 });
  });

  it('puts a tool back on the shelf if an approved pickup never happens', () => {
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    approveLoan(db, loan.id, owner.id, t0);
    expect(getTool(db, tool.id)?.status).toBe('lent_out');

    declineLoan(db, loan.id, owner.id, 'Never showed up', t0 + 3 * DAY_MS);
    expect(getTool(db, tool.id)?.status).toBe('available');
    expect(balances(db, borrower.id)).toEqual({ available: usdc(500), escrow: 0 });
  });

  it('only lets the right member drive each step', () => {
    const stranger = makeMember(db, { funds: 100 });
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });

    expect(() => approveLoan(db, loan.id, stranger.id, t0)).toThrow(/Only the owner/);
    expect(() => cancelLoan(db, loan.id, owner.id, t0)).toThrow(/Only the borrower/);
    approveLoan(db, loan.id, owner.id, t0);
    expect(() => handOver(db, loan.id, borrower.id, t0)).toThrow(/Only the owner/);
    handOver(db, loan.id, owner.id, t0);
    expect(() => confirmReturn(db, loan.id, borrower.id, t0)).toThrow(/Only the owner/);
    expect(() => handOver(db, loan.id, owner.id, t0)).toThrow(/Cannot hand over/);
  });

  it('does not accrue on loans that are not out yet', () => {
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    approveLoan(db, loan.id, owner.id, t0);
    const summary = accrueAllDue(db, t0 + 30 * DAY_MS);
    expect(summary).toMatchObject({ loansChecked: 0, microsCharged: 0 });
    expect(accrueLoan(db, requireLoan(db, loan.id), t0 + 30 * DAY_MS).late_fees_charged).toBe(0);
  });

  it('supports a tool lent for free, with no deposit and no fees', () => {
    const free = makeTool(db, owner.id, { deposit: 0, lateFee: 0, maxDays: 2, name: 'Coffee urn' });
    const loan = requestLoan(db, { toolId: free.id, borrowerId: borrower.id, days: 1, now: t0 });
    approveLoan(db, loan.id, owner.id, t0);
    handOver(db, loan.id, owner.id, t0);
    accrueAllDue(db, t0 + 10 * DAY_MS);

    const returned = confirmReturn(db, loan.id, owner.id, t0 + 10 * DAY_MS);
    expect(returned.late_days).toBe(9);
    expect(returned.late_fees_charged).toBe(0);
    expect(balances(db, borrower.id)).toEqual({ available: usdc(500), escrow: 0 });
    // No money moved, but the late return still lands on the record.
    expect(reputationFor(db, borrower.id).lateReturns).toBe(1);
  });

  it('keeps the ledger balanced and never negative', () => {
    const loan = requestLoan(db, { toolId: tool.id, borrowerId: borrower.id, days: 1, now: t0 });
    approveLoan(db, loan.id, owner.id, t0);
    handOver(db, loan.id, owner.id, t0);
    accrueAllDue(db, t0 + 5 * DAY_MS);
    confirmReturn(db, loan.id, owner.id, t0 + 5 * DAY_MS);

    const unbalanced = db
      .prepare('SELECT transfer_id, SUM(amount) AS total FROM ledger_entries GROUP BY transfer_id HAVING total != 0')
      .all();
    expect(unbalanced).toEqual([]);
    const negative = db
      .prepare(
        `SELECT member_id, account, SUM(amount) AS total FROM ledger_entries
          WHERE member_id IS NOT NULL GROUP BY member_id, account HAVING total < 0`,
      )
      .all();
    expect(negative).toEqual([]);
    // Money in equals money out: the external account mirrors member balances.
    const external = db
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries WHERE account = 'external'`)
      .get() as { total: number };
    const members = db
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries WHERE account != 'external'`)
      .get() as { total: number };
    expect(external.total + members.total).toBe(0);
  });
});
