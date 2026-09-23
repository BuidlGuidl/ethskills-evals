import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePayouts, decodePayouts, MAX_AMOUNT } from '../src/encode.mjs';
import { decodeTransferFailedIndex } from '../src/batcher.mjs';
import { FeeStrategy } from '../src/feeStrategy.mjs';
import { summarise, annualise } from '../src/gasReport.mjs';

const A = (n) => '0x' + n.toString(16).padStart(40, '0');

test('encodes 32 bytes per payout', () => {
  const blob = encodePayouts([{ to: A(1), amount: 5n }, { to: A(2), amount: 6n }]);
  assert.equal((blob.length - 2) / 2, 64);
});

test('round-trips through decode', () => {
  const ps = [{ to: A(0xabc), amount: 1n }, { to: A(0xdef), amount: MAX_AMOUNT }];
  assert.deepEqual(decodePayouts(encodePayouts(ps)), ps);
});

test('rejects amounts that overflow uint96', () => {
  assert.throws(() => encodePayouts([{ to: A(1), amount: MAX_AMOUNT + 1n }]), /exceeds uint96/);
});

test('rejects non-positive and non-bigint amounts', () => {
  assert.throws(() => encodePayouts([{ to: A(1), amount: 0n }]), /positive/);
  assert.throws(() => encodePayouts([{ to: A(1), amount: 5 }]), /bigint/);
});

test('rejects malformed addresses', () => {
  assert.throws(() => encodePayouts([{ to: '0x123', amount: 1n }]), /bad address/);
});

test('empty payout list encodes to empty blob', () => {
  assert.equal(encodePayouts([]), '0x');
});

test('decodes the failing index out of a TransferFailed revert', () => {
  const data = '0xc39ba1a9' + (7n).toString(16).padStart(64, '0');
  assert.equal(decodeTransferFailedIndex(data), 7);
});

test('ignores reverts that are not TransferFailed', () => {
  assert.equal(decodeTransferFailedIndex('0xdeadbeef'), null);
  assert.equal(decodeTransferFailedIndex(undefined), null);
});

test('fee ladder opens low and escalates', () => {
  const f = new FeeStrategy();
  const base = 5_000_000n;
  assert.equal(f.fees(base, 0).maxPriorityFeePerGas, 1_000n);
  assert.ok(f.fees(base, 2).maxPriorityFeePerGas > f.fees(base, 0).maxPriorityFeePerGas);
  // maxFeePerGas must leave headroom above the current base fee
  assert.ok(f.fees(base, 0).maxFeePerGas > base);
});

test('fee ladder saturates at its last rung', () => {
  const f = new FeeStrategy();
  const last = f.fees(5_000_000n, 99).maxPriorityFeePerGas;
  assert.equal(last, f.cfg.tipLadder[f.cfg.tipLadder.length - 1]);
});

test('replacement bids beat the previous by at least 10%', () => {
  const f = new FeeStrategy();
  const prev = { maxPriorityFeePerGas: 1_000_000n, maxFeePerGas: 20_000_000n };
  const next = f.replacementFees(5_000_000n, 1, prev);
  assert.ok(next.maxPriorityFeePerGas >= (prev.maxPriorityFeePerGas * 110n) / 100n);
  assert.ok(next.maxFeePerGas >= (prev.maxFeePerGas * 110n) / 100n);
});

test('gas report splits L1 and L2 and counts payouts per batch', () => {
  const s = summarise([
    { gasUsed: 1_000_000n, effectiveGasPrice: 6_000_000n, l1Fee: 3_000_000_000n, batchSize: 200 },
  ], 2716.44);
  assert.equal(s.payouts, 200);
  assert.equal(s.l2FeeWei, 6_000_000_000_000n);
  assert.ok(s.l1SharePct > 0 && s.l1SharePct < 1);
  assert.equal(s.gasPerPayout, 5000);
});

test('annualise scales a per-payout cost', () => {
  const a = annualise(0.001, 40_000);
  assert.equal(a.perDayUsd, 40);
  assert.equal(a.perYearUsd, 40 * 365);
});
