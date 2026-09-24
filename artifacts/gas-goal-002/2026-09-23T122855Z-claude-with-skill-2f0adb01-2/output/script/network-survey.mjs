/**
 * Evidence for the two claims the fee policy rests on:
 *   1. Base's base fee sits at its 0.005 gwei floor essentially always, so
 *      there is no cheap hour to wait for and no spike to insure against.
 *   2. A large share of transactions land with a near-zero tip, so the opening
 *      tip can be tiny.
 *
 *   node script/network-survey.mjs [--fee-blocks 1024] [--tip-blocks 60]
 *
 * Writes script/network-survey.json.
 */

import { writeFileSync } from "node:fs";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const RPC = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : Number(process.argv[i + 1]); };
const FEE_BLOCKS = arg("fee-blocks", 1024);
const TIP_BLOCKS = arg("tip-blocks", 60);

const client = createPublicClient({ chain: base, transport: http(RPC, { timeout: 60_000, retryCount: 3 }) });

const quantiles = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    n: s.length, min: s[0], p25: q(0.25), median: q(0.5),
    mean: s.reduce((a, c) => a + c, 0) / s.length,
    p75: q(0.75), p95: q(0.95), p99: q(0.99), max: s[s.length - 1],
  };
};

// --- base fee distribution, via one eth_feeHistory call per 1024 blocks -----
const feeSamples = [];
let cursor = await client.getBlockNumber();
while (feeSamples.length < FEE_BLOCKS) {
  const count = Math.min(1024, FEE_BLOCKS - feeSamples.length);
  const h = await client.getFeeHistory({ blockCount: count, blockNumber: cursor, rewardPercentiles: [] });
  feeSamples.push(...h.baseFeePerGas.map(Number));
  cursor = h.oldestBlock - 1n;
}
const baseFee = quantiles(feeSamples);

// --- tips actually paid ----------------------------------------------------
const tips = [];
const latest = await client.getBlockNumber();
for (let i = 0; i < TIP_BLOCKS; i++) {
  const b = await client.getBlock({ blockNumber: latest - BigInt(i), includeTransactions: true });
  for (const t of b.transactions) {
    if (t.type === "deposit") continue; // system deposits pay no fee
    tips.push(Number((t.gasPrice ?? b.baseFeePerGas) - b.baseFeePerGas));
  }
}
const tip = quantiles(tips);
const shareBelow = (w) => (100 * tips.filter((t) => t < w).length) / tips.length;

const gwei = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === "n" ? v : v / 1e9]));
const out = {
  measuredAt: new Date().toISOString(),
  latestBlock: Number(latest),
  baseFeeGwei: gwei(baseFee),
  atFloorPct: +((100 * feeSamples.filter((f) => f <= 5_000_000).length) / feeSamples.length).toFixed(2),
  tipGwei: gwei(tip),
  tipShares: {
    zeroPct: +shareBelow(1).toFixed(1),
    below0_001GweiPct: +shareBelow(1_000_000).toFixed(1),
    below0_01GweiPct: +shareBelow(10_000_000).toFixed(1),
  },
};
console.log(JSON.stringify(out, null, 2));
writeFileSync(new URL("./network-survey.json", import.meta.url), JSON.stringify(out, null, 2));
