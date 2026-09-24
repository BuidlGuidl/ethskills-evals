#!/usr/bin/env node
// Audit what the relayer wallet ACTUALLY paid, from its own receipts.
//
//   RELAYER=0xYourRelayer node relayer/audit-relayer-spend.mjs
//   RELAYER=0x... BLOCKS=20000 node relayer/audit-relayer-spend.mjs
//
// Everything in PLAN.md above the batching line depends on one question the cost
// model cannot answer: is the relayer paying the ~0.006 gwei the sequencer asks
// for, or a hardcoded number that is 100x that? This reads the relayer's real
// transactions and tells you. Run it before building anything else.

const RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const RELAYER = (process.env.RELAYER || '').toLowerCase();
const BLOCKS = Number(process.env.BLOCKS || 900); // Base: ~2s blocks, 900 ~= 30 min
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
// Public RPCs rate-limit hard. We only need enough receipts for a stable p50/p90
// on gas price, so cap the receipt fetch and sample evenly across the window.
const MAX_RECEIPTS = Number(process.env.MAX_RECEIPTS || 250);

if (!/^0x[0-9a-f]{40}$/.test(RELAYER)) {
  console.error('Set RELAYER=0x... to the relayer wallet address.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let id = 0;
async function rpc(method, params = []) {
  let delay = 250;
  for (let attempt = 0; attempt < 8; attempt++) {
    let res;
    try {
      res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      });
    } catch {
      await sleep(delay); delay *= 2; continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(delay + Math.random() * delay); delay *= 2; continue;
    }
    const j = await res.json().catch(() => null);
    if (!j) { await sleep(delay); delay *= 2; continue; }
    if (j.error) {
      if (/rate|limit|busy/i.test(j.error.message)) { await sleep(delay + Math.random() * delay); delay *= 2; continue; }
      throw new Error(`${method}: ${j.error.message}`);
    }
    return j.result;
  }
  throw new Error(`${method}: gave up after retries (RPC is rate limiting). ` +
    'Set BASE_RPC_URL to a paid endpoint, or lower BLOCKS / CONCURRENCY.');
}

async function mapPool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

async function ethUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const j = await r.json();
    if (j?.ethereum?.usd) return j.ethereum.usd;
  } catch { /* ignore */ }
  return Number(process.env.ETH_USD || 2731);
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

async function main() {
  const head = Number(await rpc('eth_blockNumber'));
  const from = head - BLOCKS;
  const ethPrice = await ethUsd();
  console.log(`Scanning blocks ${from}..${head} for txs from ${RELAYER}`);

  const nums = Array.from({ length: BLOCKS + 1 }, (_, i) => from + i);
  const found = [];
  let scanned = 0;

  await mapPool(nums, async (n) => {
    const b = await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), true]);
    scanned++;
    if (scanned % 500 === 0) process.stderr.write(`  ...${scanned}/${nums.length} blocks\n`);
    if (!b) return;
    for (const t of b.transactions || []) {
      if ((t.from || '').toLowerCase() === RELAYER) {
        found.push({ hash: t.hash, baseFee: BigInt(b.baseFeePerGas || '0x0'), input: t.input || '0x' });
      }
    }
  });

  if (!found.length) {
    console.log('\nNo transactions from that address in this window. Widen BLOCKS or check the address.');
    return;
  }

  // Evenly sample if the relayer is busier than MAX_RECEIPTS allows.
  let sample = found;
  if (found.length > MAX_RECEIPTS) {
    const step = found.length / MAX_RECEIPTS;
    sample = Array.from({ length: MAX_RECEIPTS }, (_, i) => found[Math.floor(i * step)]);
    console.log(`  ${found.length} txs found; sampling ${sample.length} receipts evenly across the window`);
  }

  const receipts = await mapPool(sample, async (t) => {
    const r = await rpc('eth_getTransactionReceipt', [t.hash]);
    if (!r) return null;
    return {
      ...t,
      gasUsed: Number(BigInt(r.gasUsed)),
      effPrice: BigInt(r.effectiveGasPrice),
      l1Fee: Number(BigInt(r.l1Fee || '0x0')),
      // A reverted tx still burns its gas. Payouts that fail and get retried are
      // paid for twice.
      reverted: BigInt(r.status ?? '0x1') === 0n,
    };
  });

  const rows = receipts.filter(Boolean);
  const gwei = (v) => Number(v) / 1e9;

  const tips = rows.map((r) => Number(r.effPrice - r.baseFee)).sort((a, b) => a - b);
  const prices = rows.map((r) => Number(r.effPrice)).sort((a, b) => a - b);
  const gas = rows.map((r) => r.gasUsed).sort((a, b) => a - b);
  const costs = rows.map((r) => (r.gasUsed * Number(r.effPrice) + r.l1Fee) / 1e18 * ethPrice);
  const l1s = rows.map((r) => r.l1Fee / 1e18 * ethPrice);

  const total = costs.reduce((a, b) => a + b, 0);
  const avg = total / rows.length;
  const avgBase = rows.reduce((s, r) => s + Number(r.baseFee), 0) / rows.length;
  const avgTip = tips.reduce((a, b) => a + b, 0) / tips.length;

  const windowHours = (BLOCKS * 2) / 3600;
  const observedPerDay = (found.length / windowHours) * 24;

  console.log(`\n=== ${found.length} relayer transactions over ~${windowHours.toFixed(1)}h ` +
    `(${rows.length} receipts sampled) ===`);
  console.log(`implied volume        ${Math.round(observedPerDay).toLocaleString()} tx/day`);
  console.log(`gas used   p50/p90    ${pct(gas, 0.5).toLocaleString()} / ${pct(gas, 0.9).toLocaleString()}`);
  console.log(`avg base fee          ${gwei(avgBase).toFixed(6)} gwei`);
  console.log(`avg priority fee paid ${gwei(avgTip).toFixed(6)} gwei`);
  console.log(`eff gas price p50/p90 ${gwei(pct(prices, 0.5)).toFixed(6)} / ${gwei(pct(prices, 0.9)).toFixed(6)} gwei`);
  console.log(`avg cost per tx       $${avg.toFixed(6)}`);
  console.log(`  L1 data portion     ${((l1s.reduce((a, b) => a + b, 0) / rows.length) / avg * 100).toFixed(1)}%`);
  const failed = rows.filter((r) => r.reverted);
  if (failed.length) {
    const wasted = failed.reduce((s2, r) => s2 + (r.gasUsed * Number(r.effPrice) + r.l1Fee) / 1e18 * ethPrice, 0);
    const wastedShare = wasted / total;
    console.log(`reverted txs          ${failed.length}/${rows.length} (${(failed.length / rows.length * 100).toFixed(1)}%) ` +
      `- ${(wastedShare * 100).toFixed(1)}% of spend buys nothing`);
  } else {
    console.log('reverted txs          none in sample');
  }

  console.log(`\nextrapolated spend    $${(avg * observedPerDay).toFixed(2)}/day   ` +
    `$${(avg * observedPerDay * 365 / 12).toFixed(0)}/month   $${(avg * observedPerDay * 365).toFixed(0)}/year`);

  // The verdict that decides the plan's ranking.
  const tipGwei = gwei(avgTip);
  const floorTip = 0.001;
  console.log('\n=== Verdict ===');
  if (tipGwei > floorTip * 20) {
    const wasteful = rows.reduce((s, r) => s + r.gasUsed * (Number(r.effPrice - r.baseFee) - floorTip * 1e9), 0) / 1e18 * ethPrice;
    const perTxWaste = wasteful / rows.length;
    console.log(`OVERPAYING. Average tip is ${tipGwei.toFixed(4)} gwei; Base needs ~${floorTip} gwei.`);
    console.log(`Excess tip costs $${(perTxWaste * observedPerDay * 365).toFixed(0)}/year. Fix relayer/feeStrategy.mjs first -`);
    console.log('it is a config change and it dominates every other line item in PLAN.md.');
  } else {
    console.log(`Tips look sane (${tipGwei.toFixed(6)} gwei). You are not overpaying per unit of gas,`);
    console.log('so the remaining lever is using fewer units: batch the transfers.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
