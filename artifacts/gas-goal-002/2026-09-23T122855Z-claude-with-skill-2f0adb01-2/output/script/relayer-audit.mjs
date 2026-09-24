/**
 * What the relayer actually spent on gas, straight from chain.
 *
 * Scans a block range, keeps every transaction sent by RELAYER, and sums the
 * two things Base charges: L2 execution (gasUsed x effectiveGasPrice) and the
 * L1 data fee (l1Fee, which appears on OP-stack receipts). Reverted
 * transactions are counted separately -- they cost full price and buy nothing.
 *
 *   RELAYER=0x... BASE_RPC_URL=https://... node script/relayer-audit.mjs --hours 24
 *
 * Use an RPC you pay for. The public endpoint will rate-limit long scans.
 */

import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const RPC = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
const RELAYER = (process.env.RELAYER ?? "").toLowerCase();
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
const BLOCK_TIME_S = 2;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

if (!/^0x[0-9a-f]{40}$/.test(RELAYER)) {
  console.error("set RELAYER=0x... to the relayer wallet address");
  process.exit(1);
}

const client = createPublicClient({
  chain: base,
  transport: http(RPC, { timeout: 60_000, retryCount: 3 }),
});

// eth_getBlockReceipts is two RPC calls per block regardless of how busy it is.
// Public endpoints often do not expose it; fall back to per-transaction receipts,
// which works everywhere but will be rate-limited on a long scan.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/// Public RPCs will rate-limit a scan of this size. Back off and keep going
/// rather than losing the whole run.
async function withBackoff(fn, label) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const limited = e?.code === -32016 || /rate limit|too many requests|429/i.test(e?.details ?? e?.message ?? "");
      if (!limited || attempt >= 6) throw e;
      const wait = 500 * 2 ** attempt;
      if (attempt === 0) console.error(`rate-limited on ${label}; backing off (use a paid RPC to avoid this)`);
      await sleep(wait);
    }
  }
}

let useBlockReceipts = true;
async function blockReceipts(bn) {
  if (useBlockReceipts) {
    try {
      return await withBackoff(
        () => client.request({ method: "eth_getBlockReceipts", params: [`0x${bn.toString(16)}`] }),
        `blockReceipts ${bn}`,
      );
    } catch (e) {
      if (e?.code !== -32601 && !/does not exist|unsupported|not available/i.test(e?.message ?? "")) throw e;
      console.error("eth_getBlockReceipts unsupported on this RPC; falling back to per-tx receipts (slower, rate-limit prone)");
      useBlockReceipts = false;
    }
  }
  const block = await withBackoff(() => client.getBlock({ blockNumber: bn, includeTransactions: true }), `block ${bn} w/ txs`);
  const mine = block.transactions.filter((t) => t.from?.toLowerCase() === RELAYER);
  const out = [];
  for (const t of mine) out.push(await withBackoff(() => client.getTransactionReceipt({ hash: t.hash }), "receipt"));
  return out;
}

async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

async function main() {
  const latest = await client.getBlockNumber();
  const hours = Number(arg("hours", 24));
  const toBlock = BigInt(arg("to-block", latest));
  const fromBlock = BigInt(arg("from-block", toBlock - BigInt(Math.round((hours * 3600) / BLOCK_TIME_S))));
  const total = Number(toBlock - fromBlock) + 1;

  console.error(`scanning blocks ${fromBlock}..${toBlock} (${total}) for ${RELAYER}`);

  const blockNumbers = Array.from({ length: total }, (_, i) => fromBlock + BigInt(i));
  const acc = {
    txCount: 0, revertedCount: 0,
    l2FeeWei: 0n, l1FeeWei: 0n, revertedFeeWei: 0n,
    gasUsed: 0n, tipWei: 0n,
    firstBlock: Number(fromBlock), lastBlock: Number(toBlock),
  };
  let done = 0;

  await mapWithConcurrency(blockNumbers, CONCURRENCY, async (bn) => {
    // eth_getBlockReceipts is two RPC calls per block regardless of how busy it
    // is; fetching receipts one at a time gets you rate-limited immediately at
    // this volume.
    const header = await withBackoff(() => client.getBlock({ blockNumber: bn }), `block ${bn}`);
    const receipts = await blockReceipts(bn);
    const baseFee = header.baseFeePerGas ?? 0n;

    for (const r of receipts ?? []) {
      if (r.from?.toLowerCase() !== RELAYER) continue;
      const gasUsed = BigInt(r.gasUsed);
      const effectiveGasPrice = BigInt(r.effectiveGasPrice);
      const l2 = gasUsed * effectiveGasPrice;
      const l1 = BigInt(r.l1Fee ?? 0);
      acc.txCount++;
      acc.gasUsed += gasUsed;
      acc.l2FeeWei += l2;
      acc.l1FeeWei += l1;
      acc.tipWei += gasUsed * (effectiveGasPrice - baseFee);
      // viem parses status to "success"/"reverted"; a raw RPC receipt has "0x1"/"0x0".
      const ok = typeof r.status === "string" && !r.status.startsWith("0x")
        ? r.status === "success"
        : BigInt(r.status ?? 1) === 1n;
      if (!ok) { acc.revertedCount++; acc.revertedFeeWei += l2 + l1; }
    }
    if (++done % 500 === 0) console.error(`  ${done}/${total} blocks`);
  });

  const ethUsd = await ethPrice();
  const usd = (wei) => (Number(wei) / 1e18) * ethUsd;
  const totalWei = acc.l2FeeWei + acc.l1FeeWei;
  const windowHours = (total * BLOCK_TIME_S) / 3600;
  const perDay = (x) => (x * 24) / windowHours;

  const report = {
    window: { fromBlock: acc.firstBlock, toBlock: acc.lastBlock, hours: +windowHours.toFixed(2) },
    ethUsd,
    transactions: acc.txCount,
    reverted: acc.revertedCount,
    avgGasUsed: acc.txCount ? Number(acc.gasUsed) / acc.txCount : 0,
    avgTipGwei: acc.txCount ? Number(acc.tipWei) / Number(acc.gasUsed || 1n) / 1e9 : 0,
    spend: {
      totalUsd: +usd(totalWei).toFixed(4),
      l2ExecutionUsd: +usd(acc.l2FeeWei).toFixed(4),
      l1DataUsd: +usd(acc.l1FeeWei).toFixed(4),
      wastedOnRevertsUsd: +usd(acc.revertedFeeWei).toFixed(4),
      perTransactionUsd: acc.txCount ? +(usd(totalWei) / acc.txCount).toFixed(6) : 0,
    },
    extrapolated: {
      perDayUsd: +perDay(usd(totalWei)).toFixed(2),
      perYearUsd: +(perDay(usd(totalWei)) * 365).toFixed(2),
      txPerDay: Math.round(perDay(acc.txCount)),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

async function ethPrice() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    return (await r.json()).ethereum.usd;
  } catch {
    console.error("could not fetch ETH price, falling back to 2700");
    return 2700;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
