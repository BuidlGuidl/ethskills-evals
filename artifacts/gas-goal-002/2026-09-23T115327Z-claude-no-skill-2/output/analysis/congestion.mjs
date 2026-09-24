/**
 * Is Base congested enough to justify paying a priority fee?
 *
 * Produces the evidence behind the tip policy in relayer/fees.mjs: base-fee distribution,
 * block fullness, and the priority fees transactions actually pay to get included.
 */
import { rpc, quantile, hexToNum } from "./rpc.mjs";

const head = hexToNum(await rpc("eth_blockNumber"));

// --- base fee distribution, sampled across ~2 weeks (Base produces a block every 2s) ---
const SAMPLES = 700, STEP = 1800;
const baseFees = [];
for (let i = 0; i < SAMPLES; i++) {
  const b = await rpc("eth_getBlockByNumber", ["0x" + (head - i * STEP).toString(16), false]);
  if (b) baseFees.push(hexToNum(b.baseFeePerGas));
}
baseFees.sort((a, b) => a - b);
const gwei = (w) => (w / 1e9).toFixed(7);

console.log(`base fee over ${SAMPLES} samples spanning ~${((SAMPLES * STEP * 2) / 86400).toFixed(0)} days`);
for (const q of [0.5, 0.9, 0.99, 1]) console.log(`  p${(q * 100).toFixed(0).padStart(3)}  ${gwei(quantile(baseFees, q))} gwei`);
console.log(`  mean  ${gwei(baseFees.reduce((a, b) => a + b, 0) / baseFees.length)} gwei`);
console.log(`  at the 0.005 gwei floor: ${((baseFees.filter((f) => f <= 5e6).length / baseFees.length) * 100).toFixed(1)}%`);

// --- block fullness and the tips people actually pay ---
const fullness = [], tips = [];
let zeroTip = 0, total = 0;
for (let i = 0; i < 150; i++) {
  const b = await rpc("eth_getBlockByNumber", ["0x" + (head - i * 7).toString(16), true]);
  if (!b) continue;
  fullness.push((hexToNum(b.gasUsed) / hexToNum(b.gasLimit)) * 100);
  const baseFee = hexToNum(b.baseFeePerGas);
  for (const t of b.transactions) {
    if (t.type === "0x7e") continue; // system deposit txs pay no fee
    total++;
    const tip = t.maxPriorityFeePerGas != null
      ? Math.min(hexToNum(t.maxPriorityFeePerGas), hexToNum(t.maxFeePerGas) - baseFee)
      : hexToNum(t.gasPrice) - baseFee;
    if (tip <= 0) zeroTip++;
    tips.push(tip);
  }
}
fullness.sort((a, b) => a - b);
tips.sort((a, b) => a - b);

console.log(`\nblock fullness (${fullness.length} blocks): p50 ${quantile(fullness, 0.5).toFixed(2)}%  p99 ${quantile(fullness, 0.99).toFixed(2)}%  max ${fullness.at(-1).toFixed(2)}%`);
console.log(`priority fee paid (${total} txs): p50 ${gwei(quantile(tips, 0.5))}  p90 ${gwei(quantile(tips, 0.9))} gwei`);
console.log(`txs included with zero priority fee: ${((zeroTip / total) * 100).toFixed(1)}%`);
