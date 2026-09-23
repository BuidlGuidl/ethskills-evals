import test from "node:test";
import assert from "node:assert/strict";
import {
  calldataGas,
  estimateBatchTxGas,
  estimateIndividualTxGas,
  GAS_CONSTANTS,
} from "./gas-model.ts";

test("calldata gas counts zero and nonzero bytes", () => {
  assert.equal(calldataGas("0x"), 0n);
  assert.equal(calldataGas("0x00"), 4n);
  assert.equal(calldataGas("0xff"), 16n);
  assert.equal(calldataGas("0x0000ff"), 24n);
});

test("batching beats individual transfers for every batch size >= 2", () => {
  const individual = Number(estimateIndividualTxGas(0.5));
  for (const n of [2, 5, 10, 25, 50, 100, 200]) {
    const perEntry = Number(estimateBatchTxGas(n, 0.5)) / n;
    assert.ok(
      perEntry < individual,
      `batch of ${n} should beat individual: ${perEntry} vs ${individual}`,
    );
  }
});

test("per-entry cost decreases with batch size", () => {
  const perEntry = (n: number) => Number(estimateBatchTxGas(n, 0.5)) / n;
  assert.ok(perEntry(50) < perEntry(10));
  assert.ok(perEntry(200) < perEntry(50));
});

test("fresh recipients cost more than existing ones", () => {
  assert.ok(estimateIndividualTxGas(1) > estimateIndividualTxGas(0));
  assert.ok(estimateBatchTxGas(100, 1) > estimateBatchTxGas(100, 0));
});

test("constants match forge-measured gas points", () => {
  assert.equal(GAS_CONSTANTS.batchPerEntryExisting, 11_689n);
  assert.equal(GAS_CONSTANTS.batchPerEntryFresh, 28_789n);
  assert.equal(GAS_CONSTANTS.individualExisting, 40_259n);
  assert.equal(GAS_CONSTANTS.individualFresh, 62_183n);
});
