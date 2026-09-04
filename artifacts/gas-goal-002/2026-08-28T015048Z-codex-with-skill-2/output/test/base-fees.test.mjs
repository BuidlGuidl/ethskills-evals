import assert from "node:assert/strict";
import test from "node:test";
import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";

test("adds a rounded-up 20% gas margin", () => {
  assert.equal(bufferedGasLimit("0x64"), 120n);
  assert.equal(bufferedGasLimit(101n), 122n);
});

test("includes the Base L1 data fee in a receipt cost", () => {
  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
  });
});
