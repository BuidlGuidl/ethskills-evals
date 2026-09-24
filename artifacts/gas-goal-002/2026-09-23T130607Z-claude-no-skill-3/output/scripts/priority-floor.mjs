// What is the real minimum priority fee that actually lands on Base?
// Scans every tx in recent blocks, not just ERC-20 ones.
const RPC = process.env.BASE_RPC ?? 'https://mainnet.base.org';
const N = Number(process.env.N_BLOCKS ?? 60);
import { makeRpc } from './lib/rpc.mjs';
const client = makeRpc(RPC);
const rpcBatch = (calls) => client.batch(calls);
const head = Number(await client.call('eth_blockNumber', []));
const blocks = [];
for (let i = 0; i < N; i += 10) {
  const chunk = [];
  for (let k = i; k < Math.min(N, i + 10); k++) chunk.push(['eth_getBlockByNumber', ['0x' + (head - k).toString(16), true]]);
  // The public RPC drops the occasional request under load; skip the gaps
  // rather than letting one null poison the whole sample.
  blocks.push(...(await rpcBatch(chunk)).filter(Boolean));
}
if (blocks.length === 0) throw new Error('no blocks returned');
const tips = [];
let total = 0, deposits = 0, blockGas = [];
for (const b of blocks) {
  if (!b) continue;
  const bf = BigInt(b.baseFeePerGas);
  blockGas.push({ used: Number(BigInt(b.gasUsed)), limit: Number(BigInt(b.gasLimit)) });
  for (const tx of b.transactions) {
    total++;
    if (tx.type === '0x7e') { deposits++; continue; } // system deposit tx, no fee
    let tip;
    if (tx.maxPriorityFeePerGas != null) {
      const cap = BigInt(tx.maxFeePerGas), mp = BigInt(tx.maxPriorityFeePerGas);
      tip = cap - bf < mp ? cap - bf : mp;
    } else tip = BigInt(tx.gasPrice) - bf;
    tips.push(Number(tip < 0n ? 0n : tip));
  }
}
tips.sort((a, b) => a - b);
const pct = (p) => tips[Math.floor((tips.length - 1) * p)];
console.log(JSON.stringify({
  headBlock: head, blocksScanned: blocks.length, totalTxs: total, systemDepositTxs: deposits, userTxs: tips.length,
  baseFeeWei: Number(BigInt(blocks[0].baseFeePerGas)),
  blocksReturned: blocks.length,
  priorityFeeWei: { min: tips[0], p01: pct(0.01), p05: pct(0.05), p10: pct(0.10), p25: pct(0.25), p50: pct(0.5), p90: pct(0.9), max: tips[tips.length - 1] },
  zeroTipTxs: tips.filter((t) => t === 0).length,
  tipAtOrBelow_1e6: tips.filter((t) => t <= 1e6).length,
  blockFullness: { meanUsed: blockGas.reduce((a,b)=>a+b.used,0)/blockGas.length, limit: blockGas[0].limit,
    meanPctFull: 100*blockGas.reduce((a,b)=>a+b.used/b.limit,0)/blockGas.length },
}, null, 2));
