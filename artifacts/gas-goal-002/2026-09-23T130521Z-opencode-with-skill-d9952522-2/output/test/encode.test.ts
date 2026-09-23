import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeTransfer } from "../src/transfer.ts";
import { encodeBatchTransfer, batchSavingPerTransfer } from "../src/batch.ts";

// Expected values generated with `cast calldata` against the ABI — pinned as
// fixtures so the hand-rolled encoders can never silently drift.

test("encodeTransfer matches cast calldata output", () => {
  const got = encodeTransfer("0x1111111111111111111111111111111111111111", 1_000_000n);
  assert.equal(
    got,
    "0xa9059cbb" +
      "0000000000000000000000001111111111111111111111111111111111111111" +
      "00000000000000000000000000000000000000000000000000000000000f4240",
  );
});

test("encodeBatchTransfer matches cast calldata output", () => {
  const got = encodeBatchTransfer(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222"],
    [1_000_000n, 2_000_000n],
  );
  assert.equal(
    got,
    "0x1239ec8c" +
      "000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913" +
      "0000000000000000000000000000000000000000000000000000000000000060" +
      "00000000000000000000000000000000000000000000000000000000000000c0" +
      "0000000000000000000000000000000000000000000000000000000000000002" +
      "0000000000000000000000001111111111111111111111111111111111111111" +
      "0000000000000000000000002222222222222222222222222222222222222222" +
      "0000000000000000000000000000000000000000000000000000000000000002" +
      "00000000000000000000000000000000000000000000000000000000000f4240" +
      "00000000000000000000000000000000000000000000000000000000001e8480",
  );
});

test("batch encoders reject bad input", () => {
  assert.throws(() => encodeBatchTransfer("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", [], []));
  assert.throws(() =>
    encodeBatchTransfer("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", ["0x1111111111111111111111111111111111111111"], []),
  );
  assert.throws(() => encodeTransfer("0x1234", 1n));
});

test("batch saving model: amortized intrinsic minus loop overhead", () => {
  // 10/batch: (21,000 * 9/10) - 2,000 = 16,900 gas saved per transfer
  assert.equal(batchSavingPerTransfer(10, 53_724), 16_900);
  assert.equal(batchSavingPerTransfer(1, 53_724), 0);
  assert.equal(batchSavingPerTransfer(100, 53_724), 18_790); // cap by sanity bound
});
