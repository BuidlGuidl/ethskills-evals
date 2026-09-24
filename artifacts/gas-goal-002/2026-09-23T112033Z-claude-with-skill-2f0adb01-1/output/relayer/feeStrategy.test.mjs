import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFees, DEFAULTS } from './feeStrategy.mjs';

const GWEI = 1_000_000_000n;

test('tracks the sequencer suggestion when it is in band', () => {
  const r = computeFees({ baseFeeWei: 5_000_000n, suggestedTipWei: 2_000_000n });
  assert.equal(r.maxPriorityFeePerGas, 2_000_000n);
  assert.equal(r.maxFeePerGas, 15_000_000n + 2_000_000n); // 3x base + tip
  assert.equal(r.spike, false);
});

test('raises a too-low tip to the floor', () => {
  const r = computeFees({ baseFeeWei: 5_000_000n, suggestedTipWei: 1n });
  assert.equal(r.maxPriorityFeePerGas, DEFAULTS.minPriorityFeeWei);
});

test('clamps a mainnet-era tip constant - the expensive bug this exists to stop', () => {
  const r = computeFees({ baseFeeWei: 5_000_000n, suggestedTipWei: 2n * GWEI });
  assert.equal(r.maxPriorityFeePerGas, DEFAULTS.maxPriorityFeeWei); // 0.05 gwei
  assert.ok(r.maxPriorityFeePerGas < 2n * GWEI / 10n);
});

test('falls back to the floor when the RPC has no suggestion', () => {
  const r = computeFees({ baseFeeWei: 5_000_000n });
  assert.equal(r.maxPriorityFeePerGas, DEFAULTS.minPriorityFeeWei);
});

test('maxFeePerGas leaves headroom for a rising base fee', () => {
  const base = 5_000_000n;
  const r = computeFees({ baseFeeWei: base, suggestedTipWei: 1_000_000n });
  // Base fee can climb 12.5% per block; 3x survives ~9 consecutive full blocks.
  assert.ok(r.maxFeePerGas > base * 2n);
});

test('flags a genuine spike instead of paying through it', () => {
  const r = computeFees({ baseFeeWei: 80n * GWEI });
  assert.equal(r.spike, true);
});

test('normal L2 conditions are never flagged as a spike', () => {
  for (const b of [0n, 1_000_000n, 5_000_000n, 500_000_000n]) {
    assert.equal(computeFees({ baseFeeWei: b }).spike, false, `base ${b}`);
  }
});

test('rejects a non-bigint base fee rather than silently mispricing', () => {
  assert.throws(() => computeFees({ baseFeeWei: 5000000 }), TypeError);
});

// Two layers of protection, worth distinguishing because they save different
// amounts. The ceiling is a backstop against a bad constant; actually tracking
// the sequencer's suggestion is what gets the full saving.
test('the tip ceiling alone cuts a 1 gwei constant by ~18x', () => {
  const base = 5_000_000n; // 0.005 gwei
  const clamped = computeFees({ baseFeeWei: base, suggestedTipWei: 1n * GWEI });
  const ratio = (base + 1n * GWEI) / (base + clamped.maxPriorityFeePerGas);
  assert.equal(ratio, 18n);
});

test('tracking the live suggestion cuts a 1 gwei constant by ~167x', () => {
  const base = 5_000_000n;
  const tracked = computeFees({ baseFeeWei: base, suggestedTipWei: 1_000_000n }); // 0.001 gwei
  const ratio = (base + 1n * GWEI) / (base + tracked.maxPriorityFeePerGas);
  assert.equal(ratio, 167n);
});
