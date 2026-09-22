import test from 'node:test';
import assert from 'node:assert/strict';
import { lateDays, settle, projectedSettlement } from '../src/domain/fees.js';
import { parseUsdc } from '../src/domain/money.js';

const deposit = parseUsdc('60');
const daily = parseUsdc('3');

test('a tool returned on or before the due day is not late', () => {
  assert.equal(lateDays('2026-09-22', '2026-09-22'), 0);
  assert.equal(lateDays('2026-09-22', '2026-09-20'), 0);
});

test('late days are whole days past the due day', () => {
  assert.equal(lateDays('2026-09-22', '2026-09-25'), 3);
});

test('the fee is the daily rate times the days, and the rest goes back', () => {
  const result = settle(deposit, daily, 3);
  assert.equal(result.fee, parseUsdc('9'));
  assert.equal(result.refund, parseUsdc('51'));
  assert.equal(result.fee + result.refund, deposit);
  assert.equal(result.forfeited, false);
});

test('the fee never exceeds the deposit', () => {
  const result = settle(deposit, daily, 400);
  assert.equal(result.fee, deposit);
  assert.equal(result.refund, 0n);
  assert.equal(result.accrued, parseUsdc('1200'));
  assert.ok(result.forfeited, 'a deposit eaten by fees is marked forfeited');
});

test('the deposit is always fully accounted for', () => {
  for (let days = 0; days < 40; days += 1) {
    const result = settle(deposit, daily, days);
    assert.equal(result.fee + result.refund, deposit, `days=${days}`);
    assert.ok(result.fee >= 0n && result.refund >= 0n);
  }
});

test('a zero deposit cannot produce a fee', () => {
  const result = settle(0n, daily, 10);
  assert.equal(result.fee, 0n);
  assert.equal(result.refund, 0n);
});

test('projections use the same maths as settlement', () => {
  const loan = { depositAmount: deposit, dailyLateFee: daily, dueDay: '2026-09-22' };
  assert.deepEqual(projectedSettlement(loan, '2026-09-25'), settle(deposit, daily, 3));
});

test('rejects nonsense day counts', () => {
  assert.throws(() => settle(deposit, daily, -1));
  assert.throws(() => settle(deposit, daily, 1.5));
});
