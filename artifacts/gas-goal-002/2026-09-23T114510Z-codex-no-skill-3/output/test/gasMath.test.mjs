import test from "node:test";
import assert from "node:assert/strict";
import { dailyTransferCost, gasSavings, gweiToWei, tipSavings } from "../src/gasMath.mjs";

test("gweiToWei parses decimal gwei exactly", () => {
  assert.equal(gweiToWei("0.006"), 6_000_000n);
  assert.equal(gweiToWei("1.25"), 1_250_000_000n);
});

test("dailyTransferCost models 40k direct transfers", () => {
  const cost = dailyTransferCost({
    transfersPerDay: 40_000,
    gasUsedPerTransfer: 65_000,
    gasPriceGwei: 0.006,
    ethUsd: 2718.95,
  });

  assert.equal(cost.totalWei, 15_600_000_000_000_000n);
  assert.equal(Number(cost.eth.toFixed(4)), 0.0156);
  assert.equal(Number(cost.usd.toFixed(2)), 42.42);
});

test("gasSavings calculates per-transfer and skipped-transfer savings", () => {
  const batch = gasSavings({
    transfersPerDay: 40_000,
    gasSavedPerTransfer: 12_000,
    gasPriceGwei: 0.006,
    ethUsd: 2718.95,
  });
  assert.equal(batch.gasSaved, 480_000_000n);
  assert.equal(Number(batch.usd.toFixed(2)), 7.83);

  const dedupe = gasSavings({
    transfersPerDay: 40_000,
    gasSavedPerTransfer: 0,
    savedTransfersPerDay: 1_000,
    baselineGasUsedPerTransfer: 65_000,
    gasPriceGwei: 0.006,
    ethUsd: 2718.95,
  });
  assert.equal(dedupe.gasSaved, 65_000_000n);
  assert.equal(Number(dedupe.usd.toFixed(2)), 1.06);
});

test("tipSavings models excess priority fee", () => {
  const savings = tipSavings({
    transfersPerDay: 40_000,
    gasUsedPerTransfer: 65_000,
    currentPriorityGwei: 0.01,
    targetPriorityGwei: 0.001,
    ethUsd: 2718.95,
  });

  assert.equal(Number(savings.eth.toFixed(4)), 0.0234);
  assert.equal(Number(savings.usd.toFixed(2)), 63.62);
});
