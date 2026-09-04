import test from "node:test";
import assert from "node:assert/strict";
import { baseFeeOverrides, receiptCost } from "../src/base-relayer-fees.js";

function fakeRpc(result) {
  return async () => ({ ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result }) });
}

test("uses zero priority fee and a two-times base-fee cap", async () => {
  const fees = await baseFeeOverrides({ fetchFn: fakeRpc({ baseFeePerGas: "0x4c4b40" }) });
  assert.deepEqual(fees, {
    type: "0x2",
    maxFeePerGas: "0x989680", // 2 * 5,000,000 wei
    maxPriorityFeePerGas: "0x0",
    observedBaseFeePerGas: "5000000",
  });
});

test("reports execution and Base L1 data fees separately", () => {
  assert.deepEqual(receiptCost({
    gasUsed: "0xaff7", effectiveGasPrice: "0x5b8d80", l1Fee: "0x1d5e52c4",
  }), {
    gasUsed: "45047", effectiveGasPrice: "6000000", executionWei: "270282000000",
    l1Wei: "492720836", totalWei: "270774720836",
  });
});

test("does not invent an all-in fee when l1Fee is unavailable", () => {
  const cost = receiptCost({ gasUsed: "0x5208", effectiveGasPrice: "0x1" });
  assert.equal(cost.totalWei, null);
  assert.equal(cost.l1Wei, null);
});
