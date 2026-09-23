import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendFees, isSpike, gweiToWei, DEFAULT_FEE_POLICY } from "./fees.ts";

test("recommendFees applies headroom over base fee", () => {
  const baseFee = gweiToWei(0.005);
  const fees = recommendFees(baseFee, {
    ...DEFAULT_FEE_POLICY,
    priorityFeeGwei: 0.001,
    headroomBps: 2_500,
  });
  assert.equal(fees.maxPriorityFeePerGas, gweiToWei(0.001));
  assert.equal(fees.maxFeePerGas, gweiToWei(0.00725));
});

test("recommendFees never below priority tip", () => {
  const fees = recommendFees(0n, DEFAULT_FEE_POLICY);
  assert.equal(fees.maxFeePerGas, gweiToWei(0.001));
  assert.ok(fees.maxPriorityFeePerGas <= fees.maxFeePerGas);
});

test("recommendFees respects cap", () => {
  const fees = recommendFees(gweiToWei(10), DEFAULT_FEE_POLICY);
  assert.equal(fees.maxFeePerGas, gweiToWei(0.05));
  assert.ok(fees.maxPriorityFeePerGas <= fees.maxFeePerGas);
});

test("isSpike defers only above threshold", () => {
  assert.equal(isSpike(gweiToWei(0.005), DEFAULT_FEE_POLICY), false);
  assert.equal(isSpike(gweiToWei(0.051), DEFAULT_FEE_POLICY), true);
});
