import test from "node:test";
import assert from "node:assert/strict";
import { estimateBatchSavings, estimateCoalescingSavings, transactionCostWei } from "../src/gasMath.mjs";

test("transactionCostWei includes execution and L1 fee", () => {
  assert.equal(transactionCostWei({ gasUsed: 65_000n, gasPriceWei: 6_000_000n, l1FeeWei: 2_850_000_000n }), 392_850_000_000n);
});

test("estimateBatchSavings reports positive savings when marginal batch gas is lower", () => {
  const result = estimateBatchSavings({
    transfersPerDay: 40_000,
    gasPriceWei: 6_000_000n,
    ethUsd: 2_724.98,
    l1FeeWeiPerTransfer: 2_850_000_000n,
  });

  assert.equal(result.batchesPerDay, 400);
  assert.ok(result.savingsUsdPerDay > 10);
  assert.ok(result.savingsPct > 0.25);
});

test("estimateCoalescingSavings counts avoided transfers", () => {
  assert.deepEqual(estimateCoalescingSavings({
    originalCount: 100,
    coalescedCount: 80,
    costPerTransferUsd: 0.001,
  }), {
    avoidedTransfers: 20,
    savingsUsd: 0.02,
    savingsPct: 0.2,
  });
});
