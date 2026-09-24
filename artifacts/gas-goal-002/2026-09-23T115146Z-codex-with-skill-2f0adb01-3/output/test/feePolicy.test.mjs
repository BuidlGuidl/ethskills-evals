import test from "node:test";
import assert from "node:assert/strict";
import { buildBaseFeeOverrides, rejectLegacyGasPrice } from "../src/feePolicy.mjs";

test("buildBaseFeeOverrides submits when suggested fee is below cap", () => {
  const policy = buildBaseFeeOverrides({
    baseFeeWei: 5_000_000n,
    priorityFeeWei: 1_000_000n,
  });

  assert.equal(policy.shouldSubmit, true);
  assert.equal(policy.maxFeePerGas, 11_000_000n);
});

test("buildBaseFeeOverrides defers non-urgent payments above cap", () => {
  const policy = buildBaseFeeOverrides({
    baseFeeWei: 20_000_000n,
    priorityFeeWei: 1_000_000n,
  });

  assert.equal(policy.shouldSubmit, false);
});

test("rejectLegacyGasPrice catches stale fixed gasPrice settings", () => {
  assert.equal(rejectLegacyGasPrice({ gasPriceWei: 1_000_000_000n }).shouldSubmit, false);
  assert.equal(rejectLegacyGasPrice({ gasPriceWei: 6_000_000n }).shouldSubmit, true);
});
