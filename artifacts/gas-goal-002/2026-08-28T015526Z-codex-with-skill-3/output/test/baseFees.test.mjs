import assert from "node:assert/strict";
import test from "node:test";
import { baseFeeFields, receiptFeeWei, summarizeReceipts } from "../src/baseFees.js";

test("uses the live RPC quote rather than a hard-coded priority fee", async () => {
  const fees = await baseFeeFields({
    getBlock: async () => ({ baseFeePerGas: 5_000_000n }),
    getGasPrice: async () => 6_000_000n,
  });
  assert.deepEqual(fees, { maxPriorityFeePerGas: 1_000_000n, maxFeePerGas: 11_000_000n });
});

test("includes Base L1 data fee in finance totals", () => {
  const receipt = { gasUsed: 45_000n, effectiveGasPrice: 6_000_000n, l1Fee: 600_000_000n };
  assert.equal(receiptFeeWei(receipt), 270_600_000_000n);
  const summary = summarizeReceipts([receipt, receipt], 2_500);
  assert.equal(summary.transfers, 2);
  assert.equal(summary.totalWei, 541_200_000_000n);
  assert.equal(summary.totalUsd, 0.001353);
});
