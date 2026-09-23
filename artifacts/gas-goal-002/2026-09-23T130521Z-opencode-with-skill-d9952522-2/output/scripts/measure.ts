/**
 * Live gas spend report for finance. Rerunnable — numbers are measured from
 * the chain and a spot ETH price at run time, never from memory.
 *
 *   node scripts/measure.ts                        # market snapshot (USDC transfers)
 *   RELAYER_ADDRESS=0x... SCAN_BLOCKS=300 node scripts/measure.ts
 *                                                  # our relayer's actual recent spend
 */
import { Rpc } from "../src/rpc.ts";
import { batchSavingPerTransfer } from "../src/batch.ts";
import { formatGwei } from "../src/fees.ts";

const BASE_RPC = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const TRANSFERS_PER_DAY = 40_000;

const rpc = new Rpc(BASE_RPC);

async function ethUsd(): Promise<number> {
  const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
  const json = (await res.json()) as { data: { amount: string } };
  return Number(json.data.amount);
}

interface ReceiptSample {
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  l1Fee: bigint;
}

async function receipt(txHash: string): Promise<ReceiptSample> {
  const r = await rpc.call<{
    gasUsed: string;
    effectiveGasPrice: string;
    l1Fee?: string;
  }>("eth_getTransactionReceipt", [txHash]);
  return {
    gasUsed: BigInt(r.gasUsed),
    effectiveGasPrice: BigInt(r.effectiveGasPrice),
    l1Fee: BigInt(r.l1Fee ?? "0x0"),
  };
}

/** Sample recent ERC-20 transfer receipts — our own relayer's if RELAYER_ADDRESS is set. */
async function sampleTransfers(): Promise<{ samples: ReceiptSample[]; windowSec: number }> {
  const relayer = process.env.RELAYER_ADDRESS?.toLowerCase();
  const scanBlocks = Number(process.env.SCAN_BLOCKS ?? 60);
  const latestHex = await rpc.call<string>("eth_blockNumber");
  const latest = Number(BigInt(latestHex));
  const hashes: string[] = [];
  for (let b = latest; b > latest - scanBlocks; b--) {
    const block = await rpc.call<{
      transactions: { hash: string; from: string; to: string | null; input: string }[];
    }>("eth_getBlockByNumber", [`0x${b.toString(16)}`, true]);
    for (const tx of block.transactions) {
      const isUsdcTransfer =
        tx.to?.toLowerCase() === USDC && tx.input.startsWith("0xa9059cbb");
      if (relayer ? tx.from.toLowerCase() === relayer : isUsdcTransfer) {
        hashes.push(tx.hash);
        if (hashes.length >= 40) break;
      }
    }
    if (hashes.length >= 40) break;
  }
  const samples = await Promise.all(hashes.map(receipt));
  return { samples, windowSec: scanBlocks * 2 }; // Base: ~2s blocks
}

const usd = (eth: number, price: number) => `$${(eth * price).toFixed(4)}`;

const [price, baseFee, tip, { samples }] = await Promise.all([
  ethUsd(),
  rpc.baseFeeWei(),
  rpc.suggestedTipWei(),
  sampleTransfers(),
]);

if (samples.length === 0) {
  console.error("No matching transactions found in the scanned window.");
  process.exit(1);
}

const avg = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n) / BigInt(xs.length);
const avgGas = Number(avg(samples.map((s) => s.gasUsed)));
const avgPriceGwei = Number(avg(samples.map((s) => s.effectiveGasPrice))) / 1e9;
const avgL1Eth = Number(avg(samples.map((s) => s.l1Fee))) / 1e18;
const maxPriceGwei = Math.max(...samples.map((s) => Number(s.effectiveGasPrice) / 1e9));
const minPriceGwei = Math.min(...samples.map((s) => Number(s.effectiveGasPrice) / 1e9));

const execEthPerTx = (gwei: number) => (avgGas * gwei) / 1e9;
const daily = (gwei: number) =>
  (execEthPerTx(gwei) + avgL1Eth) * TRANSFERS_PER_DAY;

console.log(`# Gas spend report — ${new Date().toISOString()}`);
console.log(`ETH/USD $${price} · Base base fee ${formatGwei(baseFee)} gwei · suggested tip ${formatGwei(tip)} gwei`);
console.log(`Sample: ${samples.length} recent ${process.env.RELAYER_ADDRESS ? "relayer" : "USDC"} transfer receipts`);
console.log(`avg gasUsed ${avgGas.toFixed(0)} · effective price paid ${minPriceGwei.toFixed(4)}–${maxPriceGwei.toFixed(4)} gwei (avg ${avgPriceGwei.toFixed(4)}) · avg L1 data fee ${avgL1Eth.toExponential(2)} ETH`);
console.log();
console.log(`Per-transfer cost breakdown (${TRANSFERS_PER_DAY.toLocaleString()}/day):`);
for (const [label, gwei] of [
  ["disciplined (base+0.001 tip)", Number(baseFee) / 1e9 + 0.001],
  ["sample average", avgPriceGwei],
  ["sample worst", maxPriceGwei],
] as const) {
  const per = execEthPerTx(gwei) + avgL1Eth;
  console.log(
    `  ${label.padEnd(30)} ${usd(per, price)}/tx → ${usd(daily(gwei), price)}/day → ${usd(daily(gwei) * 30, price)}/mo`,
  );
}
console.log(`  (L1 data share of the disciplined figure: ${((avgL1Eth / (execEthPerTx(Number(baseFee) / 1e9 + 0.001) + avgL1Eth)) * 100).toFixed(2)}%)`);
console.log();
const n = 10;
const saved = batchSavingPerTransfer(n, avgGas);
const savedEthDaily = ((saved * (Number(baseFee) / 1e9 + 0.001)) / 1e9) * TRANSFERS_PER_DAY;
console.log(`Batching ${n}/tx saves ~${saved.toFixed(0)} gas/transfer (${((saved / avgGas) * 100).toFixed(0)}% of execution) → ~${usd(savedEthDaily, price)}/day at disciplined fees`);
