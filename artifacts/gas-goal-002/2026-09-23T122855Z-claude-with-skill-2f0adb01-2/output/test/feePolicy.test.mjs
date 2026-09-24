import test from "node:test";
import assert from "node:assert/strict";
import { computeFees, shouldPause, costWei, DEFAULT_POLICY, BASE_FEE_FLOOR_WEI } from "../src/feePolicy.mjs";

const FLOOR = BASE_FEE_FLOOR_WEI;

test("first attempt bids the configured opening tip", () => {
  const { maxPriorityFeePerGas } = computeFees(FLOOR, 0);
  assert.equal(maxPriorityFeePerGas, DEFAULT_POLICY.initialTipWei);
});

test("maxFeePerGas always covers base fee plus tip, with headroom", () => {
  for (const base of [FLOOR, 50_000_000n, 500_000_000n, 5_000_000_000n]) {
    for (let a = 0; a < 8; a++) {
      const { maxFeePerGas, maxPriorityFeePerGas } = computeFees(base, a);
      assert.ok(maxFeePerGas >= base + maxPriorityFeePerGas, `a=${a} base=${base}`);
    }
  }
});

test("escalation is strictly increasing until it hits the ceiling", () => {
  let prev = 0n;
  for (let a = 0; a < 6; a++) {
    const { maxPriorityFeePerGas: tip } = computeFees(FLOOR, a);
    if (tip < DEFAULT_POLICY.maxTipWei) assert.ok(tip > prev, `attempt ${a}: ${tip} !> ${prev}`);
    prev = tip;
  }
});

test("each escalation clears the 10% replacement threshold nodes enforce", () => {
  for (let a = 1; a < 5; a++) {
    const prev = computeFees(FLOOR, a - 1).maxPriorityFeePerGas;
    const next = computeFees(FLOOR, a).maxPriorityFeePerGas;
    assert.ok(next * 100n >= prev * 110n, `attempt ${a}: ${next} is not 10% above ${prev}`);
  }
});

test("tip never exceeds the ceiling, however many retries", () => {
  for (const a of [6, 10, 50, 1000]) {
    assert.equal(computeFees(FLOOR, a).maxPriorityFeePerGas, DEFAULT_POLICY.maxTipWei);
  }
});

test("headroom scales with a rising base fee", () => {
  const quiet = computeFees(FLOOR, 0).maxFeePerGas;
  const spike = computeFees(FLOOR * 100n, 0).maxFeePerGas;
  assert.ok(spike > quiet);
  assert.ok(spike >= FLOOR * 100n * DEFAULT_POLICY.baseFeeMultiplier);
});

test("circuit breaker trips only well above anything Base has done", () => {
  assert.equal(shouldPause(FLOOR), false);
  assert.equal(shouldPause(FLOOR * 100n), false); // 0.5 gwei, still fine
  assert.equal(shouldPause(3_000_000_000n), true);
});

test("rejects a nonsensical attempt count rather than silently bidding zero", () => {
  assert.throws(() => computeFees(FLOOR, -1));
  assert.throws(() => computeFees(FLOOR, 1.5));
});

test("costWei matches a hand-computed transfer", () => {
  // 62,159 gas at 0.005 gwei base + 0.0005 gwei tip, plus 4.756 gwei of L1 data.
  const c = costWei({ gasUsed: 62_159n, baseFeeWei: 5_000_000n, tipWei: 500_000n, l1FeeWei: 4_755_911_342n });
  assert.equal(c, 62_159n * 5_500_000n + 4_755_911_342n);
});

test("the tip is what costs money, not the maxFee headroom", () => {
  const a = computeFees(FLOOR, 0, { ...DEFAULT_POLICY, baseFeeMultiplier: 12n });
  const b = computeFees(FLOOR, 0, { ...DEFAULT_POLICY, baseFeeMultiplier: 1000n });
  assert.ok(b.maxFeePerGas > a.maxFeePerGas);
  const cost = (f) => costWei({ gasUsed: 62_159n, baseFeeWei: FLOOR, tipWei: f.maxPriorityFeePerGas });
  assert.equal(cost(a), cost(b)); // 80x the headroom, identical bill
});
