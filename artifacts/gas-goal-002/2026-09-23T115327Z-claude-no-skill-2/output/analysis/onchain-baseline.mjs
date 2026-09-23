/**
 * What a plain ERC-20 transfer actually costs on Base right now, from real receipts.
 *
 * Samples recent blocks for `transfer(address,uint256)` calls and reports the gasUsed
 * distribution plus the L1 data fee. The distribution is bimodal, and the reason matters
 * for the plan: paying an address that already holds the token rewrites a non-zero
 * storage slot (2,900 gas), while paying a brand-new holder writes a zero slot
 * (20,000 gas). That ~17k gap is the single largest driver of per-payout cost variance.
 */
import { rpc, quantile, hexToNum } from "./rpc.mjs";

const TOKEN = (process.env.TOKEN || "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913").toLowerCase();
const WANT = Number(process.env.SAMPLES || 70);

const head = hexToNum(await rpc("eth_blockNumber"));
const found = [];
for (let i = 0; i < 200 && found.length < WANT; i++) {
  const b = await rpc("eth_getBlockByNumber", ["0x" + (head - i).toString(16), true]);
  for (const t of b.transactions) {
    // 138 = "0x" + 4-byte selector + 2 words: a plain transfer, not a router call.
    if (t.to?.toLowerCase() === TOKEN && t.input.toLowerCase().startsWith("0xa9059cbb") && t.input.length === 138) {
      found.push(t);
    }
  }
}

const gas = [], l1 = [];
for (const t of found.slice(0, WANT)) {
  const r = await rpc("eth_getTransactionReceipt", [t.hash]);
  if (r?.status !== "0x1") continue;
  gas.push(hexToNum(r.gasUsed));
  l1.push(Number(BigInt(r.l1Fee || "0x0")));
}
gas.sort((a, b) => a - b);
l1.sort((a, b) => a - b);

const mean = gas.reduce((a, b) => a + b, 0) / gas.length;
console.log(`token ${TOKEN}, ${gas.length} plain transfers`);
console.log(`gasUsed  p10 ${quantile(gas, 0.1)}  p50 ${quantile(gas, 0.5)}  p90 ${quantile(gas, 0.9)}  mean ${mean.toFixed(0)}`);
console.log(`L1 data fee  p50 ${quantile(l1, 0.5).toExponential(3)} wei`);

const sampleBlock = await rpc("eth_getBlockByNumber", ["latest", false]);
const l2Wei = quantile(gas, 0.5) * hexToNum(sampleBlock.baseFeePerGas);
console.log(`L1 share of total cost at current prices: ${((quantile(l1, 0.5) / (quantile(l1, 0.5) + l2Wei)) * 100).toFixed(1)}%`);
