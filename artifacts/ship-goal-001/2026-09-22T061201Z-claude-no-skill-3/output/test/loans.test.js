import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, tool } from './helpers.js';
import { config } from '../src/config.js';
import { addDays, today as todayIn } from '../src/domain/dates.js';
import { parseUsdc } from '../src/domain/money.js';
import { availableBalance } from '../src/payments/escrow.js';
import { ESCROW, balanceOf, ledgerTotal } from '../src/payments/ledger.js';
import {
  approveLoan,
  cancelRequest,
  confirmReturn,
  declineLoan,
  expireStaleRequests,
  getLoan,
  overdueLoans,
  pendingRequestsFor,
  requestLoan,
} from '../src/services/loans.js';
import { borrowingRecord } from '../src/services/members.js';
import { browse } from '../src/services/tools.js';
import { runDailyJob } from '../src/jobs/daily.js';

const today = todayIn(config.timezone);
const day = (offset) => addDays(today, offset);

function setup() {
  const context = fixture({ members: ['Owner', 'Borrower', 'Other'] });
  const [owner, borrower, other] = context.members;
  return { ...context, owner, borrower, other, drill: tool(context.handle, owner.id) };
}

test('requesting a tool holds the deposit straight away', () => {
  const { handle, escrow, owner, borrower, drill } = setup();
  const loan = requestLoan(handle, escrow, {
    toolId: drill.id,
    borrowerId: borrower.id,
    startDay: today,
    dueDay: day(2),
  });
  assert.equal(loan.status, 'requested');
  assert.equal(availableBalance(handle, borrower.id), parseUsdc('440'));
  assert.equal(balanceOf(handle, ESCROW), parseUsdc('60'));
  assert.equal(availableBalance(handle, owner.id), parseUsdc('500'), 'the owner is not paid yet');
});

test('a request without the deposit is refused, and leaves no loan behind', () => {
  const context = fixture({ members: ['Owner', 'Broke'], funding: '10' });
  const [owner, broke] = context.members;
  const drill = tool(context.handle, owner.id);
  assert.throws(
    () =>
      requestLoan(context.handle, context.escrow, {
        toolId: drill.id,
        borrowerId: broke.id,
        startDay: today,
        dueDay: day(1),
      }),
    /need 60.00 USDC/,
  );
  assert.equal(context.handle.prepare('SELECT COUNT(*) AS n FROM loans').get().n, 0);
  assert.equal(availableBalance(context.handle, broke.id), parseUsdc('10'));
});

test('a returned-on-time loan gives the whole deposit back', () => {
  const { handle, escrow, owner, borrower, drill } = setup();
  const loan = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(2) });
  approveLoan(handle, escrow, loan.id, owner.id);
  const closed = confirmReturn(handle, escrow, loan.id, owner.id, day(2), new Date(`${day(2)}T12:00:00Z`));

  assert.equal(closed.status, 'closed');
  assert.equal(closed.late_days, 0);
  assert.equal(closed.feeCharged, 0n);
  assert.equal(availableBalance(handle, borrower.id), parseUsdc('500'));
  assert.equal(availableBalance(handle, owner.id), parseUsdc('500'));
  assert.equal(ledgerTotal(handle), 0n);
});

test('a late return pays the owner a daily fee out of the deposit', () => {
  const { handle, escrow, owner, borrower, drill } = setup();
  const loan = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(2) });
  approveLoan(handle, escrow, loan.id, owner.id);
  const closed = confirmReturn(handle, escrow, loan.id, owner.id, day(5), new Date(`${day(5)}T12:00:00Z`));

  assert.equal(closed.late_days, 3);
  assert.equal(closed.feeCharged, parseUsdc('9'));
  assert.equal(availableBalance(handle, borrower.id), parseUsdc('491'));
  assert.equal(availableBalance(handle, owner.id), parseUsdc('509'));
  assert.equal(balanceOf(handle, ESCROW), 0n);
});

test('fees stop at the deposit, and the loan still closes', () => {
  const { handle, escrow, owner, borrower } = setup();
  const cheap = tool(handle, owner.id, { name: 'Trowel', deposit: '6', dailyLateFee: '3' });
  const loan = requestLoan(handle, escrow, { toolId: cheap.id, borrowerId: borrower.id, startDay: today, dueDay: today });
  approveLoan(handle, escrow, loan.id, owner.id);
  const closed = confirmReturn(handle, escrow, loan.id, owner.id, day(40), new Date(`${day(40)}T12:00:00Z`));

  assert.equal(closed.feeCharged, parseUsdc('6'));
  assert.equal(closed.refundAmount, 0n);
  assert.equal(availableBalance(handle, owner.id), parseUsdc('506'));
});

test('declining a request returns the deposit', () => {
  const { handle, escrow, owner, borrower, drill } = setup();
  const loan = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(1) });
  const declined = declineLoan(handle, escrow, loan.id, owner.id, 'Need it myself');
  assert.equal(declined.status, 'declined');
  assert.equal(availableBalance(handle, borrower.id), parseUsdc('500'));
  assert.equal(balanceOf(handle, ESCROW), 0n);
});

test('a borrower can withdraw their own request but not someone else"s', () => {
  const { handle, escrow, owner, borrower, other, drill } = setup();
  const loan = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(1) });
  assert.throws(() => cancelRequest(handle, escrow, loan.id, other.id), /not your request/);
  assert.throws(() => approveLoan(handle, escrow, loan.id, other.id), /not your loan/);
  cancelRequest(handle, escrow, loan.id, borrower.id);
  assert.equal(getLoan(handle, loan.id).status, 'cancelled');
  assert.equal(availableBalance(handle, borrower.id), parseUsdc('500'));
});

test('approving one request declines the others for the same days and refunds them', () => {
  const { handle, escrow, owner, borrower, other, drill } = setup();
  const first = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(2) });
  const second = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: other.id, startDay: day(1), dueDay: day(3) });

  approveLoan(handle, escrow, first.id, owner.id);

  assert.equal(getLoan(handle, second.id).status, 'declined');
  assert.equal(availableBalance(handle, other.id), parseUsdc('500'));
  assert.equal(balanceOf(handle, ESCROW), parseUsdc('60'), 'only the approved loan still holds a deposit');
});

test('a tool that is already out cannot be double-booked', () => {
  const { handle, escrow, owner, borrower, other, drill } = setup();
  const loan = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(3) });
  approveLoan(handle, escrow, loan.id, owner.id);
  assert.throws(
    () => requestLoan(handle, escrow, { toolId: drill.id, borrowerId: other.id, startDay: day(2), dueDay: day(4) }),
    /already out until/,
  );
});

test('requests are validated before any money moves', () => {
  const { handle, escrow, owner, borrower, drill } = setup();
  const attempts = [
    [{ startDay: day(-1), dueDay: day(1) }, /in the past/],
    [{ startDay: day(2), dueDay: day(1) }, /before the start/],
    [{ startDay: today, dueDay: day(30) }, /at most 7 days/],
    [{ startDay: 'tomorrow', dueDay: day(1) }, /valid start date/],
  ];
  for (const [dates, expected] of attempts) {
    assert.throws(() => requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, ...dates }), expected);
  }
  assert.throws(
    () => requestLoan(handle, escrow, { toolId: drill.id, borrowerId: owner.id, startDay: today, dueDay: day(1) }),
    /your own tool/,
  );
  assert.equal(availableBalance(handle, borrower.id), parseUsdc('500'));
});

test('the same borrower cannot stack requests on one tool', () => {
  const { handle, escrow, borrower, drill } = setup();
  requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(1) });
  assert.throws(
    () => requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: day(3), dueDay: day(4) }),
    /already have an open request/,
  );
});

test('a return cannot be recorded in the future or before the loan started', () => {
  const { handle, escrow, owner, borrower, drill } = setup();
  const loan = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(2) });
  approveLoan(handle, escrow, loan.id, owner.id);
  assert.throws(() => confirmReturn(handle, escrow, loan.id, owner.id, day(1)), /in the future/);
  assert.throws(() => confirmReturn(handle, escrow, loan.id, owner.id, day(-1)), /before the loan started/);
  assert.throws(() => confirmReturn(handle, escrow, loan.id, borrower.id, today), /not your loan/);
});

test('a closed loan cannot be closed twice', () => {
  const { handle, escrow, owner, borrower, drill } = setup();
  const loan = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(1) });
  approveLoan(handle, escrow, loan.id, owner.id);
  confirmReturn(handle, escrow, loan.id, owner.id, today);
  assert.throws(() => confirmReturn(handle, escrow, loan.id, owner.id, today), /already closed/);
  assert.equal(availableBalance(handle, borrower.id), parseUsdc('500'));
});

test('late returns show up in the borrower track record', () => {
  const { handle, escrow, owner, borrower, drill } = setup();
  const late = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(1) });
  approveLoan(handle, escrow, late.id, owner.id);
  confirmReturn(handle, escrow, late.id, owner.id, day(3), new Date(`${day(3)}T12:00:00Z`));

  const record = borrowingRecord(handle, borrower.id);
  assert.equal(record.completedLoans, 1);
  assert.equal(record.lateLoans, 1);
  assert.equal(record.lateDays, 2);
  assert.ok(record.score < borrowingRecord(handle, owner.id).score, 'a late return costs standing');
});

test('the owner queue puts the better track record first', () => {
  const { handle, escrow, owner, borrower, other, drill } = setup();
  // `other` builds a clean record on a second tool; `borrower` returns late.
  const spare = tool(handle, owner.id, { name: 'Saw', deposit: '10', dailyLateFee: '1' });
  const clean = requestLoan(handle, escrow, { toolId: spare.id, borrowerId: other.id, startDay: today, dueDay: today });
  approveLoan(handle, escrow, clean.id, owner.id);
  confirmReturn(handle, escrow, clean.id, owner.id, today);

  const messy = requestLoan(handle, escrow, { toolId: spare.id, borrowerId: borrower.id, startDay: today, dueDay: today });
  approveLoan(handle, escrow, messy.id, owner.id);
  confirmReturn(handle, escrow, messy.id, owner.id, day(4), new Date(`${day(4)}T12:00:00Z`));

  requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: day(1), dueDay: day(2) });
  requestLoan(handle, escrow, { toolId: drill.id, borrowerId: other.id, startDay: day(1), dueDay: day(2) });

  const queue = pendingRequestsFor(handle, owner.id);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].borrower_id, other.id, 'the reliable neighbour is asked about first');
});

test('browse puts reliable owners first and tools that are out last', () => {
  const { handle, escrow, owner, borrower, other, drill } = setup();
  const otherTool = tool(handle, other.id, { name: 'Hedge trimmer' });
  // `other` has a spotless record; the owner has none at all.
  const clean = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: other.id, startDay: today, dueDay: today });
  approveLoan(handle, escrow, clean.id, owner.id);
  confirmReturn(handle, escrow, clean.id, owner.id, today);

  const listed = browse(handle, { excludeOwnerId: borrower.id });
  assert.deepEqual(listed.map((t) => t.id), [otherTool.id, drill.id]);

  // Lend the hedge trimmer out and it drops below the available drill.
  const out = requestLoan(handle, escrow, { toolId: otherTool.id, borrowerId: borrower.id, startDay: today, dueDay: day(1) });
  approveLoan(handle, escrow, out.id, other.id);
  assert.deepEqual(browse(handle, {}).map((t) => t.id), [drill.id, otherTool.id]);
});

test('requests nobody answered expire on their start day and refund', () => {
  const { handle, escrow, borrower, drill } = setup();
  const loan = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(1) });
  assert.equal(expireStaleRequests(handle, escrow), 0, 'not stale on the start day itself');

  const later = new Date(`${day(2)}T09:00:00Z`);
  assert.equal(expireStaleRequests(handle, escrow, later), 1);
  assert.equal(getLoan(handle, loan.id).status, 'expired');
  assert.equal(availableBalance(handle, borrower.id), parseUsdc('500'));
});

test('the daily job nudges both sides of an overdue loan, once a day', () => {
  const { handle, escrow, owner, borrower, drill } = setup();
  const loan = requestLoan(handle, escrow, { toolId: drill.id, borrowerId: borrower.id, startDay: today, dueDay: day(1) });
  approveLoan(handle, escrow, loan.id, owner.id);

  const later = new Date(`${day(3)}T09:00:00Z`);
  assert.equal(overdueLoans(handle, later).length, 1);

  const first = runDailyJob(handle, escrow, later);
  assert.equal(first.overdueReminders, 1);
  const notices = () => handle.prepare('SELECT COUNT(*) AS n FROM notices WHERE kind LIKE ?').get('overdue%').n;
  assert.equal(notices(), 2, 'one for the borrower, one for the owner');

  runDailyJob(handle, escrow, later);
  assert.equal(notices(), 2, 'running the job twice in a day does not spam anyone');
});
