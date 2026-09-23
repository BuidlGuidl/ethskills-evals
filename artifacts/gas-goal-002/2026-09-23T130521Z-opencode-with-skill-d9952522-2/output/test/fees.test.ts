import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveFees, BASE_FEE_POLICY } from "../src/fees.ts";

const G = 1_000_000_000n; // 1 gwei

test("at the measured floor (0.005 base, 0.001 tip): send with maxFee = 2*base+tip", () => {
  const d = deriveFees(5_000_000n, 1_000_000n);
  assert.ok(d.send);
  assert.equal(d.maxFeePerGas, 11_000_000n); // 0.011 gwei
  assert.equal(d.maxPriorityFeePerGas, 1_000_000n);
});

test("sequencer tip spike is capped at maxTipWei", () => {
  const d = deriveFees(5_000_000n, G / 10n); // sequencer suggests 0.1 gwei
  assert.ok(d.send);
  assert.equal(d.maxPriorityFeePerGas, BASE_FEE_POLICY.maxTipWei);
});

test("base fee above cap → hold, don't chase congestion", () => {
  const d = deriveFees(20_000_000n, 1_000_000n); // 0.02 > 0.01 cap
  assert.equal(d.send, false);
  if (!d.send) assert.match(d.reason, /queue and retry/);
});

test("maxFee ceiling is a hard guard", () => {
  const d = deriveFees(9_000_000n, 1_000_000n, {
    ...BASE_FEE_POLICY,
    baseFeeCapWei: 100_000_000n,
    maxFeeCeilingWei: 15_000_000n,
  });
  assert.equal(d.send, false); // 2*9+1 = 19 > 15
});

test("zero suggested tip still sends (floor base fee only)", () => {
  const d = deriveFees(5_000_000n, 0n);
  assert.ok(d.send);
  assert.equal(d.maxFeePerGas, 10_000_000n);
});
