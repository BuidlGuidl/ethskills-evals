#!/usr/bin/env node
import process from "node:process";

const USAGE = `
gas-audit.mjs — measure what a relayer actually spends on gas (Base / any OP-stack L2)

  node scripts/gas-audit.mjs --relayer 0xYourRelayerAddress [options]

Options:
  --relayer <address>   relayer wallet address (required)
  --rpc <url>           JSON-RPC endpoint (default https://mainnet.base.org)
  --blocks <n>          recent blocks to scan (default 150, ~5 min on Base)
  --eth-price <usd>     ETH price; default fetched from coingecko
  --per-day <n>         transfers per day to project (default 40000)

Prints measured L2 execution fees, L1 data fees, and projected daily/annual spend,
plus what the same traffic would cost batched through the Disburser contract.
`;

function parseArgs(argv) {
  const args = { rpc: "https://mainnet.base.org", blocks: 150, perDay: 40000 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--relayer") args.relayer = argv[++i];
    else if (a === "--rpc") args.rpc = argv[++i];
    else if (a === "--blocks") args.blocks = Number(argv[++i]);
    else if (a === "--eth-price") args.ethPrice = Number(argv[++i]);
    else if (a === "--per-day") args.perDay = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}\n`);
      console.log(USAGE);
      process.exit(1);
    }
  }
  if (!args.relayer || !/^0x[0-9a-fA-F]{40}$/.test(args.relayer)) {
    console.error("--relayer <0x...> is required\n");
    console.log(USAGE);
    process.exit(1);
  }
  return args;
}

async function rpc(url, method, params) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (res.status === 429 || res.status === 503) {
      if (attempt >= 5) throw new Error(`RPC rate-limited: ${method}`);
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    const json = await res.json();
    if (json.error) throw new Error(`RPC error on ${method}: ${JSON.stringify(json.error)}`);
    return json.result;
  }
}

async function fetchEthPrice(fallback) {
  if (fallback) return fallback;
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const json = await res.json();
    return json.ethereum.usd;
  } catch {
    return 2724;
  }
}

const fmtUsd = (v) => `$${v < 0.01 && v > 0 ? v.toFixed(6) : v.toFixed(4)}`;

async function main() {
  const args = parseArgs(process.argv);
  const ethPrice = await fetchEthPrice(args.ethPrice);
  const relayer = args.relayer.toLowerCase();

  const latestHex = await rpc(args.rpc, "eth_getBlockByNumber", ["latest", false]);
  const latest = parseInt(latestHex.number, 16);

  let scanned = 0;
  let found = 0;
  let totalGas = 0n;
  let totalL1FeeWei = 0n;
  let totalL2FeeWei = 0n;
  let l1Units = 0n;
  let failed = 0;
  let withL1 = 0;

  for (let b = latest; b > latest - args.blocks && b > 0; b--) {
    const block = await rpc(args.rpc, "eth_getBlockByNumber", ["0x" + b.toString(16), true]);
    scanned++;
    for (const tx of block.transactions ?? []) {
      if (tx.from?.toLowerCase() !== relayer) continue;
      found++;
      const receipt = await rpc(args.rpc, "eth_getTransactionReceipt", [tx.hash]);
      if (receipt.status !== "0x1") failed++;
      const gasUsed = BigInt(receipt.gasUsed);
      const price = BigInt(receipt.effectiveGasPrice ?? tx.gasPrice ?? "0x0");
      totalGas += gasUsed;
      totalL2FeeWei += gasUsed * price;
      if (receipt.l1Fee !== undefined) {
        withL1++;
        totalL1FeeWei += BigInt(receipt.l1Fee);
        l1Units += BigInt(receipt.l1GasUsed ?? 0n);
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  const perTxL2Eth = found > 0 ? Number(totalL2FeeWei) / found / 1e18 : 0;
  const perTxL1Eth = found > 0 ? Number(totalL1FeeWei) / found / 1e18 : 0;
  const perTxCost = (perTxL2Eth + perTxL1Eth) * ethPrice;
  const avgGas = found > 0 ? Number(totalGas) / found : 0;
  const avgL1Units = withL1 > 0 ? Number(l1Units) / withL1 : 1600;

  const BATCHED_GAS_WARM = 12943;
  const BATCHED_GAS_COLD = 29955;
  const batchedGas = (BATCHED_GAS_WARM + BATCHED_GAS_COLD) / 2;
  const avgEffGwei = found > 0 ? Number(totalL2FeeWei) / Number(totalGas) / 1e9 : 0.006;
  const batchedPerTxCost = (batchedGas * avgEffGwei * 1e-9) * ethPrice + (perTxL1Eth * (35 / avgL1Units)) * ethPrice;

  const p = (x) => (x * 100).toFixed(1) + "%";
  console.log(`Relayer gas audit (Base)
  scanned blocks:    ${scanned} (~${(scanned * 2 / 60).toFixed(1)} min)
  relayer txs found: ${found} (${failed} reverted)`);
  if (found === 0) {
    console.log(`
  No transactions from this address in the scanned window.
  Increase --blocks (e.g. 1500 for ~50 minutes) and try again.`);
    return;
  }
  console.log(`  avg gas used/tx:   ${avgGas.toFixed(0)}
  avg L2 fee/tx:     ${fmtUsd(perTxL2Eth * ethPrice)}
  avg L1 data fee:   ${fmtUsd(perTxL1Eth * ethPrice)} (avg ${avgL1Units.toFixed(0)} compressed units)
  avg total/tx:      ${fmtUsd(perTxCost)}
  ETH price used:    $${ethPrice}

Projected at ${args.perDay.toLocaleString()} transfers/day:
  current:           ${fmtUsd(perTxCost * args.perDay)}/day  ${fmtUsd(perTxCost * args.perDay * 365)}/yr
  batched (Disburser): ${fmtUsd(batchedPerTxCost * args.perDay)}/day  ${fmtUsd(batchedPerTxCost * args.perDay * 365)}/yr
  savings:           ${fmtUsd((perTxCost - batchedPerTxCost) * args.perDay)}/day  (${p(1 - batchedPerTxCost / perTxCost)})

Note: batched projection uses fork-measured gas on real USDC (warm ~12.9k, cold ~30k
gas/transfer at 250/batch). Re-run with a larger --blocks window for a tighter sample.
`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
