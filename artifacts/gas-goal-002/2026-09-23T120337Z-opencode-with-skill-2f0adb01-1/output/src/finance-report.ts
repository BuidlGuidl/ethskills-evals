import { RpcClient, type Receipt, type Hex } from "./rpc.ts";

const GWEI = 1_000_000_000n;
const ETH = 1_000_000_000_000_000_000n;

const DEFAULT_RPCS = [
  "https://base-rpc.publicnode.com",
  "https://1rpc.io/base",
  "https://base.drpc.org",
];
const DEFAULT_BLOCKSCOUT = "https://base.blockscout.com/api/v2";
const TRANSFER_SELECTOR = "0xa9059cbb";

interface TxRow {
  hash: Hex;
  timestamp: string;
  to: string | null;
  input: string;
}

async function fetchEthPriceUsd(): Promise<number> {
  const envPrice = process.env.ETH_PRICE_USD;
  if (envPrice) return Number(envPrice);
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json();
    return json.ethereum.usd;
  } catch {
    return 0;
  }
}

async function fetchBlockscoutTxs(
  address: string,
  blockscoutUrl: string,
  cutoffMs: number
): Promise<TxRow[]> {
  const rows: TxRow[] = [];
  let extra = "";
  for (let round = 0; round < 100; round++) {
    const url = `${blockscoutUrl}/addresses/${address}/transactions?filter=from${extra}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`blockscout ${res.status}`);
    const json = await res.json();
    const items = json.items ?? [];
    if (items.length === 0) break;
    let hitOld = false;
    for (const item of items) {
      const ts = Date.parse(item.timestamp);
      if (ts < cutoffMs) {
        hitOld = true;
        break;
      }
      if (item.hash) {
        rows.push({
          hash: item.hash,
          timestamp: item.timestamp,
          to: item.to?.hash ?? null,
          input: item.raw_input ?? item.input ?? "0x",
        });
      }
    }
    const next = json.next_page_params;
    if (hitOld || !next) break;
    const params = new URLSearchParams(next).toString();
    extra = `&${params}`;
    await new Promise((r) => setTimeout(r, 300));
  }
  return rows;
}

async function fetchHashesFromFile(cutoffMs: number): Promise<TxRow[]> {
  const file = process.env.HASHES_FILE!;
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(file, "utf8");
  const rpc = new RpcClient(process.env.RPC_URL ?? DEFAULT_RPCS);
  const rows: TxRow[] = [];
  for (const line of content.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const tx = await rpc.getTransaction(line as Hex);
    if (tx) {
      const block = await rpc.getBlock(BigInt(tx.blockNumber));
      const ts = Number(BigInt(block.timestamp)) * 1000;
      if (ts >= cutoffMs) {
        rows.push({ hash: tx.hash, timestamp: new Date(ts).toISOString(), to: tx.to, input: tx.input });
      }
    }
  }
  return rows;
}

async function fetchReceipts(rpc: RpcClient, hashes: Hex[]): Promise<(Receipt | null)[]> {
  const out: (Receipt | null)[] = [];
  const CONCURRENCY = 4;
  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < hashes.length) {
      const my = idx++;
      try {
        out[my] = await rpc.getReceipt(hashes[my]);
      } catch {
        out[my] = null;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  });
  await Promise.all(workers);
  return out;
}

function percentile(sorted: bigint[], p: number): bigint {
  if (sorted.length === 0) return 0n;
  const k = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[k];
}

async function main() {
  const address = process.env.ADDRESS;
  if (!address && !process.env.HASHES_FILE) {
    console.error("set ADDRESS=<relayer address> (or HASHES_FILE=<file of tx hashes>)");
    process.exit(1);
  }
  const hours = Number(process.env.HOURS ?? 24);
  const cutoffMs = Date.now() - hours * 3600_000;
  const rpc = new RpcClient(process.env.RPC_URL ?? DEFAULT_RPCS, 5, 800);
  const blockscoutUrl = process.env.BLOCKSCOUT_URL ?? DEFAULT_BLOCKSCOUT;

  const rows = process.env.HASHES_FILE
    ? await fetchHashesFromFile(cutoffMs)
    : await fetchBlockscoutTxs(address!, blockscoutUrl, cutoffMs);

  if (rows.length === 0) {
    console.log(`no transactions found in the last ${hours}h window`);
    return;
  }

  const receipts = await fetchReceipts(
    rpc,
    rows.map((r) => r.hash)
  );

  let l2FeeWeiTotal = 0n;
  let l1FeeWeiTotal = 0n;
  let gasTotal = 0n;
  let transferCount = 0;
  let transferGasTotal = 0n;
  const effPrices: bigint[] = [];
  let missingL1 = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = receipts[i];
    if (!r) continue;
    const gasUsed = BigInt(r.gasUsed);
    const eff = BigInt(r.effectiveGasPrice);
    l2FeeWeiTotal += gasUsed * eff;
    gasTotal += gasUsed;
    effPrices.push(eff);
    if (r.l1Fee) {
      l1FeeWeiTotal += BigInt(r.l1Fee);
    } else {
      missingL1++;
    }
    const row = rows[i];
    if (row.to && row.input?.startsWith(TRANSFER_SELECTOR)) {
      transferCount++;
      transferGasTotal += gasUsed;
    }
  }

  effPrices.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const p50 = percentile(effPrices, 50);
  const p90 = percentile(effPrices, 90);
  const ethPrice = await fetchEthPriceUsd();

  const l2Eth = Number(l2FeeWeiTotal) / 1e18;
  const l1Eth = Number(l1FeeWeiTotal) / 1e18;
  const totalEth = l2Eth + l1Eth;
  const totalUsd = totalEth * ethPrice;
  const n = effPrices.length;
  const perTxUsd = n > 0 ? totalUsd / n : 0;
  const perDayUsd = (totalUsd / hours) * 24;
  const perMonthUsd = perDayUsd * 30;
  const baseFeeGwei = Number(await rpc.getBaseFee()) / 1e9;

  const fmt = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 9 });
  console.log(`## Relayer gas spend (last ${hours}h)`);
  console.log();
  console.log(`| metric | value |`);
  console.log(`|---|---|`);
  console.log(`| transactions analyzed | ${n} |`);
  console.log(`| ERC-20 transfer() calls | ${transferCount} |`);
  console.log(`| avg gas per tx | ${n > 0 ? Number(gasTotal / BigInt(n)).toLocaleString() : 0} |`);
  if (transferCount > 0) {
    console.log(
      `| avg gas per ERC-20 transfer | ${Number(transferGasTotal / BigInt(transferCount)).toLocaleString()} |`
    );
  }
  console.log(`| L2 execution fees | ${fmt(l2Eth)} ETH ($${fmt(l2Eth * ethPrice)}) |`);
  console.log(`| L1 data fees | ${fmt(l1Eth)} ETH ($${fmt(l1Eth * ethPrice)}) |`);
  console.log(`| total fees | ${fmt(totalEth)} ETH ($${fmt(totalUsd)}) |`);
  console.log(`| cost per tx | $${fmt(perTxUsd)} |`);
  console.log(`| observed run-rate | $${fmt(perDayUsd)}/day ($${fmt(perMonthUsd)}/month) |`);
  console.log(`| at 40,000 tx/day | $${fmt(perTxUsd * 40_000)}/day ($${fmt(perTxUsd * 40_000 * 30)}/month) |`);
  console.log();
  console.log(`| fee health | value |`);
  console.log(`|---|---|`);
  console.log(`| current Base base fee | ${baseFeeGwei.toFixed(4)} gwei |`);
  console.log(`| your median effective gas price | ${Number(p50) / 1e9} gwei |`);
  console.log(`| your p90 effective gas price | ${Number(p90) / 1e9} gwei |`);
  const overpayX = baseFeeGwei > 0 ? (Number(p50) / 1e9) / (baseFeeGwei + 0.001) : 0;
  console.log(`| median overpayment vs floor | ${overpayX.toFixed(1)}x |`);
  console.log(`| transfers batched into 1 tx would save | ~49-63% of L2 gas |`);
  if (missingL1 > 0) {
    console.log();
    console.log(`note: ${missingL1} receipts did not expose l1Fee (RPC lacks OP-Stack fields)`);
  }
  console.log();
  console.log(
    `suggested first action: ${overpayX > 2 ? `fix fees (overpaying ${overpayX.toFixed(1)}x)` : "deploy MultiSender batching"}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
