import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, loanRow, tool } from './helpers.js';
import { parseUsdc } from '../src/domain/money.js';
import { ESCROW, balanceOf, ledgerTotal, memberAccount, post } from '../src/payments/ledger.js';
import { availableBalance, fund, withdraw } from '../src/payments/escrow.js';

test('funding a member leaves the ledger summing to zero', () => {
  const { handle, members } = fixture();
  assert.equal(availableBalance(handle, members[0].id), parseUsdc('500'));
  assert.equal(ledgerTotal(handle), 0n, 'every credit has a matching debit');
});

test('a member cannot spend USDC they do not have', () => {
  const { handle, members } = fixture({ funding: '10' });
  assert.throws(
    () => withdraw(handle, members[0].id, parseUsdc('10.000001')),
    (error) => error.code === 'INSUFFICIENT_FUNDS',
  );
  assert.equal(availableBalance(handle, members[0].id), parseUsdc('10'));
});

test('escrow holds move money out of the member and back again', () => {
  const { handle, escrow, members } = fixture();
  const [borrower, owner] = members;
  const amount = parseUsdc('60');
  const drill = tool(handle, owner.id);
  loanRow(handle, { toolId: drill.id, borrowerId: borrower.id, ownerId: owner.id });

  escrow.hold(handle, { loanId: 1, memberId: borrower.id, amount });
  assert.equal(availableBalance(handle, borrower.id), parseUsdc('440'));
  assert.equal(balanceOf(handle, ESCROW), amount);

  escrow.capture(handle, 1, { fee: parseUsdc('9'), ownerId: owner.id });
  assert.equal(availableBalance(handle, borrower.id), parseUsdc('491'));
  assert.equal(availableBalance(handle, owner.id), parseUsdc('509'));
  assert.equal(balanceOf(handle, ESCROW), 0n, 'escrow is emptied by settlement');
  assert.equal(ledgerTotal(handle), 0n);
});

test('a hold can only be resolved once', () => {
  const { handle, escrow, members } = fixture();
  const drill = tool(handle, members[1].id);
  loanRow(handle, { toolId: drill.id, borrowerId: members[0].id, ownerId: members[1].id });
  escrow.hold(handle, { loanId: 1, memberId: members[0].id, amount: parseUsdc('20') });
  escrow.release(handle, 1);
  assert.throws(() => escrow.release(handle, 1), /already released/);
  assert.throws(() => escrow.capture(handle, 1, { fee: 0n, ownerId: members[1].id }), /already released/);
});

test('ledger entries must be positive and go somewhere else', () => {
  const { handle, members } = fixture();
  const account = memberAccount(members[0].id);
  assert.throws(() => post(handle, { from: account, to: ESCROW, amount: 0n, kind: 'x' }), /positive/);
  assert.throws(() => post(handle, { from: account, to: account, amount: 1n, kind: 'x' }), /different accounts/);
  assert.throws(() => post(handle, { from: account, to: ESCROW, amount: 5, kind: 'x' }), /bigint/);
});

test('the treasurer can credit and debit a member', () => {
  const { handle, members } = fixture({ funding: null });
  fund(handle, members[0].id, parseUsdc('75'), 'tx 0xabc');
  withdraw(handle, members[0].id, parseUsdc('25'), 'payout');
  assert.equal(availableBalance(handle, members[0].id), parseUsdc('50'));
  assert.equal(ledgerTotal(handle), 0n);
});
