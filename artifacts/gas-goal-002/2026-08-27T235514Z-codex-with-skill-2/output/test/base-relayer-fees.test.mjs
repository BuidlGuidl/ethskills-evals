import assert from "node:assert/strict";
import test from "node:test";
import { receiptCost, suggestFees } from "../src/base-relayer-fees.mjs";

test("accounts for Base execution and L1 data fee", () => {
  const cost = receiptCost({ gasUsed: "0x9d43", effectiveGasPrice: "0x5b8d80", l1Fee: "0x1de6c823" });
  assert.equal(cost.executionWei, 241_554_000_000n);
  assert.equal(cost.l1Wei, 501_663_779n);
  assert.equal(cost.totalWei, 242_055_663_779n);
});

test("derives fees from fresh Base RPC values rather than a fixed priority fee", async () => {
  const fetchFn = async (_url, options) => {
    const { method } = JSON.parse(options.body);
    const result = method === "eth_gasPrice" ? "0x5b8d80" : { baseFeePerGas: "0x4c4b40" };
    return { ok: true, json: async () => ({ result }) };
  };
  const fees = await suggestFees({ fetchFn, cushionBps: 1_250 });
  assert.deepEqual(fees, { baseFeePerGas: "0x4c4b40", maxPriorityFeePerGas: "0xf4240", maxFeePerGas: "0x66ff30" });
});
