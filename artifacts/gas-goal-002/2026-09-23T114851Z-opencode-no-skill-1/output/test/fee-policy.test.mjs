import test from "node:test";
import assert from "node:assert/strict";
import {
  computeFeePolicy,
  estimateNextBaseFee,
  fromFeeHistoryRpc,
} from "../src/fee-policy.mjs";

const G = (g) => BigInt(Math.round(g * 1e9));

function history(baseGwei, ratios, rewardsGwei = [0.0001, 0.0005, 0.001]) {
  return {
    baseFeePerGasWei: baseGwei.map((g) => G(g).toString()),
    rewardsWei: ratios.map((r) => rewardsGwei.map((g) => G(g).toString())),
    gasUsedRatio: ratios,
  };
}

test("policy uses p75 priority and 1559 buffer over next base fee", () => {
  const h = history([0.005, 0.005, 0.005, 0.005, 0.005], [0.4, 0.5, 0.3, 0.5, 0.5]);
  const p = computeFeePolicy(h);
  assert.equal(BigInt(p.maxPriorityFeePerGasWei), G(0.001));
  assert.equal(BigInt(p.maxFeePerGasWei), G(0.005) * 125n / 100n + G(0.001));
  assert.equal(p.acceptable, true);
});

test("priority fee clamped to cap", () => {
  const h = history([0.005, 0.005], [0.5, 0.5], [0.05, 0.5]);
  const p = computeFeePolicy(h, { priorityCapGwei: 0.01 });
  assert.equal(BigInt(p.maxPriorityFeePerGasWei), G(0.01));
});

test("next base fee follows EIP-1559 elasticity", () => {
  const base = [G(0.01), G(0.01)].map(String);
  assert.equal(estimateNextBaseFee(base, [0.5]), G(0.01));
  assert.equal(estimateNextBaseFee(base, [1.0]), G(0.01) * 9n / 8n);
  assert.equal(estimateNextBaseFee(base, [0.75]), G(0.01) + G(0.01) / 16n);
  assert.equal(estimateNextBaseFee(base, [0.25]), G(0.01) - G(0.01) / 16n);
});

test("hard ceiling marks policy unacceptable when exceeded", () => {
  const h = history([3, 3], [0.5, 0.5]);
  const p = computeFeePolicy(h, { hardCeilingGwei: 1 });
  assert.equal(p.acceptable, false);
});

test("fromFeeHistoryRpc maps rpc fields", () => {
  const mapped = fromFeeHistoryRpc({
    baseFeePerGas: [G(0.005).toString(16), G(0.005).toString(16)],
    reward: [[G(0.0001).toString(16)], [G(0.0002).toString(16)]],
    gasUsedRatio: [0.5, 0.6],
  });
  assert.deepEqual(mapped.baseFeePerGasWei, [G(0.005).toString(), G(0.005).toString()]);
  assert.deepEqual(mapped.rewardsWei, [[G(0.0001).toString()], [G(0.0002).toString()]]);
  const p = computeFeePolicy(mapped);
  assert.equal(BigInt(p.maxPriorityFeePerGasWei), G(0.0002));
});
