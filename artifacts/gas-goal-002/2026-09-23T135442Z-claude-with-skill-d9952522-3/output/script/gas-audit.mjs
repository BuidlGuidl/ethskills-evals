/**
 * What the relayer actually spent on gas, from its own receipts.
 *
 * Reports the split between L2 execution and the L1 data fee, and the portion
 * of spend that came from volunteering more tip than the block required --
 * which is the number to act on, because it is refundable-by-policy rather
 * than intrinsic to the work.
 *
 *   node script/gas-audit.mjs 0xRelayer... [--blocks 43200]
 *
 * 43,200 Base blocks is ~24h at 2s. Public RPCs prune; point RPC_URL at a
 * provider with history for a full month.
 */
const RPC_URL = process.env.RPC_URL || "https://base.publicnode.com";
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);

const args = process.argv.slice(2);
const relayer = (args.find((a) => a.startsWith("0x")) || "").toLowerCase();
const blockSpan = Number(args[args.indexOf("--blocks") + 1]) || 43_200;
if (!relayer) {
  console.error("usage: node script/gas-audit.mjs 0xRelayerAddress [--blocks N]");
  process.exit(1);
}

let id = 1;
async function rpc(method, params = []) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }),
    });
    const j = await res.json().catch(() => null);
    // Public endpoints rate-limit aggressively; back off rather than skewing
    // the sample by silently dropping blocks.
    if (j?.error && /rate limit|429/i.test(j.error.message) && attempt < 6) {
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      continue;
    }
    if (j?.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
    return j.result;
  }
}

async function ethUsd() {
  const r = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
  return Number((await r.json()).data.amount);
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

const head = parseInt(await rpc("eth_blockNumber"), 16);
const from = head - blockSpan;
console.error(`scanning blocks ${from}..${head} for ${relayer} via ${RPC_URL}`);

const blocks = await mapLimit(
  Array.from({ length: blockSpan }, (_, i) => from + i),
  CONCURRENCY,
  (b) => rpc("eth_getBlockByNumber", ["0x" + b.toString(16), true])
);

const rows = [];
for (const blk of blocks) {
  if (!blk) continue;
  const baseFee = BigInt(blk.baseFeePerGas ?? 0);
  for (const tx of blk.transactions) {
    if (tx.from?.toLowerCase() !== relayer) continue;
    rows.push({ hash: tx.hash, baseFee });
  }
}
console.error(`found ${rows.length} transactions; fetching receipts`);

const receipts = await mapLimit(rows, CONCURRENCY, async (r) => {
  const rc = await rpc("eth_getTransactionReceipt", [r.hash]);
  return {
    ...r,
    gasUsed: BigInt(rc.gasUsed),
    effectiveGasPrice: BigInt(rc.effectiveGasPrice),
    l1Fee: BigInt(rc.l1Fee ?? 0),
    reverted: rc.status !== "0x1",
  };
});

const price = await ethUsd();
const WEI = 10n ** 18n;
const usd = (wei) => (Number(wei) / Number(WEI)) * price;

let l2 = 0n, l1 = 0n, tipPaid = 0n, floorCost = 0n, revertedWei = 0n;
for (const r of receipts) {
  const l2Wei = r.gasUsed * r.effectiveGasPrice;
  const tip = r.effectiveGasPrice > r.baseFee ? r.effectiveGasPrice - r.baseFee : 0n;
  l2 += l2Wei;
  l1 += r.l1Fee;
  tipPaid += r.gasUsed * tip;
  // What the same transactions would have cost at base fee + a 1,000 wei tip.
  floorCost += r.gasUsed * (r.baseFee + 1_000n) + r.l1Fee;
  if (r.reverted) revertedWei += l2Wei + r.l1Fee;
}

const total = l2 + l1;
const days = (blockSpan * 2) / 86_400;
const pct = (v) => ((Number(v) / Number(total)) * 100).toFixed(1) + "%";
const line = (label, wei) =>
  console.log(`  ${label.padEnd(34)} ${usd(wei).toFixed(2).padStart(10)} USD  ${pct(wei).padStart(6)}`);

console.log(`\n=== relayer gas audit ===`);
console.log(`relayer      ${relayer}`);
console.log(`window       ${days.toFixed(2)} days (${blockSpan} blocks)`);
console.log(`transactions ${receipts.length}  (${receipts.filter((r) => r.reverted).length} reverted)`);
console.log(`ETH/USD      ${price}\n`);
line("L2 execution", l2);
line("L1 data fee", l1);
line("TOTAL", total);
console.log();
line("  of which: tip above base fee", tipPaid);
line("  of which: spent on reverts", revertedWei);
console.log();

const saving = total - floorCost;
console.log(`same transactions at base fee + 1000 wei tip: ${usd(floorCost).toFixed(2)} USD`);
console.log(`  avoidable via fee policy alone:            ${usd(saving).toFixed(2)} USD  (${pct(saving)})`);

if (receipts.length) {
  const perDay = Number(total) / days;
  console.log(`\nrun rate: ${usd(BigInt(Math.round(perDay))).toFixed(2)} USD/day  ->  ${(usd(BigInt(Math.round(perDay))) * 365).toFixed(0)} USD/year`);
  const gas = receipts.map((r) => r.gasUsed).sort((a, b) => (a < b ? -1 : 1));
  console.log(`median gasUsed/tx: ${gas[Math.floor(gas.length / 2)]}`);
}
