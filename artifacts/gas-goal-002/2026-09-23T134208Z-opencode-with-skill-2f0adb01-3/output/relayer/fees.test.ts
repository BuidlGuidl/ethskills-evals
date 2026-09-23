import test from "node:test";
import assert from "node:assert/strict";
import { defaultFeePolicy, quoteFees, GWEI } from "./fees.ts";

const BASE_FLOOR = 5_000_000n;

test("lean base fee gets floor tip and non-deferred quote", () => {
  const quote = quoteFees(BASE_FLOOR, defaultFeePolicy());
  assert.equal(quote.maxPriorityFeePerGas, 1_000_000n);
  assert.equal(quote.maxFeePerGas, 7_250_000n);
  assert.equal(quote.defer, false);
});

test("tip scales with base fee and stays capped", () => {
  const scaled = quoteFees(100_000_000n, defaultFeePolicy());
  assert.equal(scaled.maxPriorityFeePerGas, 10_000_000n);
  assert.equal(scaled.defer, false);
  const capped = quoteFees(2n * GWEI, defaultFeePolicy());
  assert.equal(capped.maxPriorityFeePerGas, 50_000_000n);
  assert.equal(capped.defer, true);
});

test("base fee spike above hard cap defers", () => {
  const quote = quoteFees(GWEI, defaultFeePolicy());
  assert.equal(quote.defer, true);
});

test("max fee always covers base plus tip", () => {
  const policy = defaultFeePolicy();
  for (const base of [5_000_000n, 25_000_000n, 100_000_000n, 500_000_000n]) {
    const quote = quoteFees(base, policy);
    assert.ok(quote.maxFeePerGas >= base + quote.maxPriorityFeePerGas);
  }
});
