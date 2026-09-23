import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { base } from 'viem/chains';

/**
 * Gas spend report for the relayer wallet — the finance answer.
 *
 *   node src/report.js <relayerAddress> [--blocks N] [--from B] [--to B]
 *
 * Scans recent blocks, finds txs sent by the relayer, and sums the true cost
 * of each: gasUsed * effectiveGasPrice (L2 execution) + l1Fee (L1 data, from
 * the OP Stack receipt field). Prints ETH and USD totals plus per-tx average
 * and an extrapolated daily/monthly run-rate.
 *
 * Default samples the last 1,000 blocks (~33 min on Base). For full history,
 * point BASE_RPC_URL at an archive node and pass --from/--to, or use an
 * indexer (Basescan API, Dune) — scanning 43k blocks/day over public RPC is slow.
 */

const ETH_USD_FEED = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70';
const feedAbi = parseAbi(['function latestAnswer() view returns (int256)']);
const RPC = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
const CONCURRENCY = 8;

const client = createPublicClient({ chain: base, transport: http(RPC) });

function parseArgs() {
  const args = process.argv.slice(2);
  const relayer = args[0];
  if (!relayer?.startsWith('0x')) {
    console.error('usage: node src/report.js <relayerAddress> [--blocks N] [--from B] [--to B]');
    process.exit(1);
  }
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? Number(args[i + 1]) : undefined;
  };
  return { relayer: relayer.toLowerCase(), blocks: opt('--blocks') ?? 1000, from: opt('--from'), to: opt('--to') };
}

async function mapPool(items, fn, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

async function main() {
  const { relayer, blocks, from, to } = parseArgs();
  const latest = Number(await client.getBlockNumber());
  const toBlock = to ?? latest;
  const fromBlock = from ?? toBlock - blocks + 1;
  console.log(`Scanning blocks ${fromBlock}..${toBlock} for txs from ${relayer}`);

  const ethUsd = Number(await client.readContract({ address: ETH_USD_FEED, abi: feedAbi, functionName: 'latestAnswer' })) / 1e8;

  const blockNums = Array.from({ length: toBlock - fromBlock + 1 }, (_, i) => BigInt(fromBlock + i));
  const txs = [];
  await mapPool(blockNums, async (n) => {
    const block = await client.getBlock({ blockNumber: n, includeTransactions: true });
    for (const tx of block.transactions) {
      if (tx.from?.toLowerCase() === relayer) txs.push(tx.hash);
    }
  }, CONCURRENCY);

  const receipts = await mapPool(txs, (hash) => client.getTransactionReceipt({ hash }), CONCURRENCY);

  let execWei = 0n, l1Wei = 0n, gas = 0n, failed = 0;
  for (const r of receipts) {
    execWei += r.gasUsed * r.effectiveGasPrice;
    l1Wei += r.l1Fee ?? 0n;
    gas += r.gasUsed;
    if (r.status !== 'success') failed++;
  }
  const total = execWei + l1Wei;
  const usd = (w) => `$${((Number(w) / 1e18) * ethUsd).toFixed(2)}`;
  const spanSeconds = (toBlock - fromBlock + 1) * 2; // Base: 2s blocks
  const perDay = spanSeconds > 0 ? (total * 86_400n) / BigInt(spanSeconds) : 0n;

  console.log(`
Relayer gas spend, blocks ${fromBlock}-${toBlock} (~${(spanSeconds / 3600).toFixed(1)}h), ETH $${ethUsd.toFixed(0)}:
  transactions:        ${receipts.length} (${failed} failed)
  gas used:            ${gas}
  L2 execution cost:   ${formatEther(execWei)} ETH (${usd(execWei)})
  L1 data cost:        ${formatEther(l1Wei)} ETH (${usd(l1Wei)})
  total:               ${formatEther(total)} ETH (${usd(total)})
  avg per tx:          ${receipts.length ? formatEther(total / BigInt(receipts.length)) : '0'} ETH
  run-rate at this pace: ${usd(perDay)}/day, ${usd(perDay * 30n)}/month`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
