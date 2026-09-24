import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBaseFeePolicy,
  calculateBatchSavings,
  calculateTransferCost,
  percentile
} from "../src/baseGasMath.mjs";

test("calculateTransferCost includes execution gas and OP-stack l1 fee", () => {
  const cost = calculateTransferCost({
    gasUsed: 62_000n,
    gasPriceWei: 6_000_000n,
    l1FeeWei: 3_200_000_000n,
    ethUsd: 2728.965,
    transfersPerDay: 40_000n
  });

  assert.equal(cost.executionWei, 372_000_000_000n);
  assert.equal(cost.totalWeiPerTransfer, 375_200_000_000n);
  assert.ok(Math.abs(cost.dailyUsd - 40.963) < 0.01);
});

test("buildBaseFeePolicy derives a Base-sized priority fee from live gas price inputs", () => {
  const policy = buildBaseFeePolicy({
    baseFeeWei: 5_000_000n,
    gasPriceWei: 6_000_000n
  });

  assert.equal(policy.suggestedPriorityFeeWei, 1_000_000n);
  assert.equal(policy.maxPriorityFeePerGas, 1_000_000n);
  assert.equal(policy.maxFeePerGas, 11_000_000n);
});

test("buildBaseFeePolicy caps oversized priority fees", () => {
  const policy = buildBaseFeePolicy({
    baseFeeWei: 5_000_000n,
    gasPriceWei: 25_000_000n,
    maxPriorityFeeWei: 1_000_000n
  });

  assert.equal(policy.suggestedPriorityFeeWei, 20_000_000n);
  assert.equal(policy.maxPriorityFeePerGas, 1_000_000n);
  assert.equal(policy.maxFeePerGas, 11_000_000n);
});

test("calculateBatchSavings reports absolute and percent savings", () => {
  const savings = calculateBatchSavings({
    directGasUsed: 62_000n,
    batchedGasPerTransfer: 44_000n,
    gasPriceWei: 6_000_000n,
    directL1FeeWei: 3_200_000_000n,
    batchedL1FeePerTransferWei: 2_100_000_000n,
    ethUsd: 2728.965,
    transfersPerDay: 40_000n
  });

  assert.ok(Math.abs(savings.savedUsdPerDay - 11.9092) < 0.001);
  assert.ok(Math.abs(savings.savedPct - 29.0778) < 0.001);
});

test("percentile uses nearest-rank percentile", () => {
  assert.equal(percentile([5n, 1n, 3n, 2n, 4n], 50), 3n);
  assert.equal(percentile([5n, 1n, 3n, 2n, 4n], 90), 5n);
});
