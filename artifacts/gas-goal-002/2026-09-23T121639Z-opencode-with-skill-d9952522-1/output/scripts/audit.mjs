// Audits what the relayer actually spends on gas vs the live-minimum
// counterfactual: for each recent tx, what was paid (gasUsed x effectiveGasPrice
// + l1Fee) vs what a minimum-tip EIP-1559 tx in the same block would have cost.
//
// Usage:
//   node scripts/audit.mjs --address 0x<relayer>
//   node scripts/audit.mjs --address 0x<relayer> --limit 200 --min-tip-gwei 0.001
//
// tx list comes from the public Blockscout API on Base (no key needed);
// receipts and block data come from the configured Base RPC.
import { rpc, BASE_RPC_URL, fmtUsd, ethUsd } from "./lib/base.mjs";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf("--" + name);
  return i === -1 || i + 1 >= args.length ? fallback : args[i + 1];
}
const address = arg("address");
if (!address || !address.startsWith("0x")) {
  console.error("usage: node scripts/audit.mjs --address 0x<relayer> [--limit N]");
  process.exit(2);
}
const limit = Number(arg("limit", "150"));
const minTipGwei = Number(arg("min-tip-gwei", "0.001"));
const MIN_TIP_WEI = BigInt(Math.round(minTipGwei * 1e9));

const BLOCKSCOUT = "https://base.blockscout.com/api/v2";

async function fetchTxs() {
  const out = [];
  let next = `${BLOCKSCOUT}/addresses/${address}/transactions?filter=to%20%7C%20from`;
  for (let page = 0; next && page < 5; page++) {
    const res = await fetch(next, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Blockscout HTTP ${res.status} — pass tx hashes manually or retry`);
    const json = await res.json();
    out.push(...json.items);
    next = json.next_page_params
      ? `${BLOCKSCOUT}/addresses/${address}/transactions?filter=to%20%7C%20from&` +
        new URLSearchParams(json.next_page_params).toString()
      : null;
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

const txs = await fetchTxs();
if (txs.length === 0) {
  console.error("no transactions found for this address on Blockscout");
  process.exit(1);
}

const eth = await ethUsd();
const blockCache = new Map();
async function blockOf(n) {
  if (!blockCache.has(n)) {
    blockCache.set(n, await rpc("eth_getBlockByNumber", ["0x" + n.toString(16), false]));
  }
  return blockCache.get(n);
}

let actualEth = 0n, minimalEth = 0n, execEth = 0n, l1Eth = 0n, tipExcessWei = 0n;
let counted = 0, failed = 0;
const perToken = new Map();

for (const tx of txs) {
  if (tx.status !== "ok" && !tx.hash) continue;
  const rc = await rpc("eth_getTransactionReceipt", [tx.hash]);
  if (!rc || rc.status !== "0x1") { failed++; continue; }
  const block = await blockOf(parseInt(rc.blockNumber, 16));
  const baseFee = BigInt(block.baseFeePerGas);
  const gasUsed = BigInt(rc.gasUsed);
  const effPrice = BigInt(rc.effectiveGasPrice);
  const l1Fee = BigInt(rc.l1Fee ?? "0");
  const execPaid = gasUsed * effPrice;
  const execMin = gasUsed * (baseFee + MIN_TIP_WEI);
  const tipExcess = effPrice > baseFee + MIN_TIP_WEI ? effPrice - baseFee - MIN_TIP_WEI : 0n;

  actualEth += execPaid + l1Fee;
  minimalEth += execMin + l1Fee;
  execEth += execPaid;
  l1Eth += l1Fee;
  tipExcessWei += tipExcess * gasUsed;
  counted++;

  if (rc.to && /^0x[0-9a-f]{40}$/.test(rc.to)) {
    const key = rc.to.toLowerCase();
    perToken.set(key, (perToken.get(key) ?? 0n) + execPaid + l1Fee);
  }
}

const toEth = (wei) => Number(wei) / 1e18;
const usd = (wei) => toEth(wei) * eth;

console.log(`Relayer audit — ${address}`);
console.log(`  successful txs audited: ${counted} (of ${txs.length} fetched, ${failed} reverted/skipped)`);
console.log(`  ETH/USD: $${eth}`);
console.log("");
console.log("Actual spend in window:");
console.log(`  L2 execution : ${fmtUsd(usd(execEth))}`);
console.log(`  L1 data fees : ${fmtUsd(usd(l1Eth))} (${((toEth(l1Eth) / toEth(actualEth)) * 100).toFixed(1)}% of total)`);
console.log(`  total        : ${fmtUsd(usd(actualEth))}`);
console.log("");
console.log("Counterfactual (same txs, same blocks, minimum tip):");
console.log(`  total        : ${fmtUsd(usd(minimalEth))}`);
console.log(`  overpayment  : ${fmtUsd(usd(actualEth - minimalEth))} (${((toEth(actualEth - minimalEth) / toEth(actualEth)) * 100).toFixed(1)}%)`);
console.log(`  of which excess priority fee: ${fmtUsd(usd(tipExcessWei))}`);
console.log("");
console.log("Per-transfer average:");
if (counted > 0) {
  const per = toEth(actualEth) / counted;
  const perMin = toEth(minimalEth) / counted;
  console.log(`  actual ${fmtUsd(per * eth)}/tx vs minimum ${fmtUsd(perMin * eth)}/tx`);
}
if (perToken.size) {
  console.log("");
  console.log("Spend by destination contract (top 5):");
  [...perToken.entries()]
    .sort((a, b) => (b[1] > a[1] ? 1 : -1))
    .slice(0, 5)
    .forEach(([addr, wei]) => console.log(`  ${addr} ${fmtUsd(usd(wei))}`));
}
console.log("");
console.log(`audit rpc: ${BASE_RPC_URL}, tx source: Blockscout Base, min tip assumed: ${minTipGwei} gwei`);
