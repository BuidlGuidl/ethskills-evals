// Samples real ERC-20 transfer txs on Base mainnet and reports the actual
// cost breakdown (L2 execution vs L1 data availability) from receipts.
const RPC = process.env.BASE_RPC ?? 'https://mainnet.base.org';
const N_BLOCKS = Number(process.env.N_BLOCKS ?? 40);

import { makeRpc } from './lib/rpc.mjs';
const client = makeRpc(RPC);
const rpc = (method, params) => client.call(method, params);
const rpcBatch = (calls) => client.batch(calls);

const TRANSFER = '0xa9059cbb';
const TRANSFER_FROM = '0x23b872dd';

const head = Number(await rpc('eth_blockNumber', []));
const blocks = [];
for (let i = 0; i < N_BLOCKS; i++) {
  blocks.push(['eth_getBlockByNumber', ['0x' + (head - i).toString(16), true]]);
}
const fetched = [];
for (let i = 0; i < blocks.length; i += 10) {
  fetched.push(...(await rpcBatch(blocks.slice(i, i + 10))));
}

// Collect candidate simple-transfer txs
const cands = [];
for (const b of fetched.filter(Boolean)) {
  if (!b) continue;
  for (const tx of b.transactions) {
    const sel = (tx.input || '').slice(0, 10);
    if (sel !== TRANSFER && sel !== TRANSFER_FROM) continue;
    // a bare transfer() is 4 + 64 bytes of args = 68 bytes = 138 hex chars + '0x'
    const argBytes = ((tx.input.length - 10) / 2) | 0;
    if (sel === TRANSFER && argBytes !== 64) continue;
    if (sel === TRANSFER_FROM && argBytes !== 96) continue;
    cands.push({ tx, sel, rawLen: (tx.input.length - 2) / 2, baseFee: BigInt(b.baseFeePerGas) });
  }
}

const receipts = [];
for (let i = 0; i < cands.length; i += 10) {
  receipts.push(
    ...(await rpcBatch(cands.slice(i, i + 10).map((c) => ['eth_getTransactionReceipt', [c.tx.hash]])))
  );
}

const rows = [];
for (let i = 0; i < cands.length; i++) {
  const r = receipts[i];
  if (!r || r.status !== '0x1') continue;
  const gasUsed = BigInt(r.gasUsed);
  const egp = BigInt(r.effectiveGasPrice);
  const l1Fee = BigInt(r.l1Fee ?? '0x0');
  rows.push({
    hash: r.transactionHash,
    sel: cands[i].sel,
    token: r.to,
    gasUsed,
    effectiveGasPrice: egp,
    baseFee: cands[i].baseFee,
    l2Fee: gasUsed * egp,
    l1Fee,
    l1GasUsed: BigInt(r.l1GasUsed ?? '0x0'),
    total: gasUsed * egp + l1Fee,
  });
}

const num = (a) => a.map(Number).sort((x, y) => x - y);
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))];
const stat = (arr) => ({ n: arr.length, min: arr[0], p50: pct(arr, 0.5), p90: pct(arr, 0.9), max: arr[arr.length - 1], mean: arr.reduce((a, b) => a + b, 0) / arr.length });

const out = {
  rpc: RPC,
  headBlock: head,
  blocksSampled: N_BLOCKS,
  sampleSize: rows.length,
  gasUsed: stat(num(rows.map((r) => r.gasUsed))),
  effectiveGasPriceWei: stat(num(rows.map((r) => r.effectiveGasPrice))),
  baseFeeWei: stat(num(rows.map((r) => r.baseFee))),
  priorityFeeWei: stat(num(rows.map((r) => r.effectiveGasPrice - r.baseFee))),
  l2FeeWei: stat(num(rows.map((r) => r.l2Fee))),
  l1FeeWei: stat(num(rows.map((r) => r.l1Fee))),
  totalFeeWei: stat(num(rows.map((r) => r.total))),
  // Two views of the same thing. The aggregate is what the whole sample paid,
  // but a handful of transactions bidding enormous priority fees dominate it.
  // The median share is the better guide to what a steady relayer will see.
  l1ShareAggregatePct: 100 * Number(rows.reduce((a, r) => a + r.l1Fee, 0n)) / Number(rows.reduce((a, r) => a + r.total, 0n)),
  l1ShareMedianPct: 100 * pct(num(rows.map((r) => r.l1Fee)), 0.5) / pct(num(rows.map((r) => r.total)), 0.5),
};
console.log(JSON.stringify(out, null, 2));
