import { encodeFunctionData, fromRlp, http, createPublicClient, serializeTransaction, type Hex } from "viem";
import { GAS_PRICE_ORACLE, USDC_BASE, packItem } from "../src/pack.ts";

const RPCS = [
  process.env.BASE_RPC,
  "https://base.publicnode.com",
  "https://mainnet.base.org",
  "https://1rpc.io/base",
].filter(Boolean) as string[];

async function readWithFallback<T>(fn: (client: ReturnType<typeof createPublicClient>) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (const rpc of RPCS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fn(createPublicClient({ transport: http(rpc) }));
      } catch (e) {
        lastErr = e;
        const retryable = String(e).includes("rate limit") || String(e).includes("429");
        if (!retryable || attempt === 2) break;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
const TRANSFERS_PER_DAY = 40_000;
const EXEC_GAS_STANDALONE = 77_000;
const EXEC_GAS_BATCH_PER_ITEM = 26_700;
const BATCH_SIZES = [100, 256];
const TIP_WEI = 1_000_000n;

const GPO_ABI = [
  { type: "function", name: "getL1Fee", inputs: [{ name: "data", type: "bytes" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getL1FeeUpperBound", inputs: [{ name: "unsignedTxSize", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "baseFeeScalar", inputs: [], outputs: [{ name: "", type: "uint32" }], stateMutability: "view" },
  { type: "function", name: "blobBaseFeeScalar", inputs: [], outputs: [{ name: "", type: "uint32" }], stateMutability: "view" },
  { type: "function", name: "l1BaseFee", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "blobBaseFee", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

const ERC20_ABI = [
  { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
] as const;

const SEND_ABI_ITEM = [
  { type: "function", name: "send", inputs: [{ name: "token", type: "address" }, { name: "items", type: "bytes32[]" }], outputs: [], stateMutability: "nonpayable" },
] as const;

const BATCH_SENDER_PLACEHOLDER = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

function pseudoRecipient(i: number): Hex {
  let h = "";
  let s = i * 2654435761 + 0x9e3779b9;
  for (let j = 0; j < 40; j++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    h += ((s >>> 16) & 15).toString(16);
  }
  return `0x${h}` as Hex;
}

function standaloneCalldata(recipient: Hex): Hex {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [recipient, 25_000_000n],
  });
}

function batchCalldata(n: number): Hex {
  const items: Hex[] = [];
  for (let i = 0; i < n; i++) items.push(packItem(pseudoRecipient(i), 25_000_000n));
  return encodeFunctionData({
    abi: SEND_ABI_ITEM,
    functionName: "send",
    args: [USDC_BASE, items],
  });
}

function unsignedTx(to: Hex, data: Hex, gas: bigint): Hex {
  const serialized = serializeTransaction({
    type: "eip1559",
    chainId: 8453,
    nonce: 42,
    gas,
    maxFeePerGas: 6_100_000n,
    maxPriorityFeePerGas: TIP_WEI,
    to,
    value: 0n,
    data,
  });
  const decoded = fromRlp(`0x${serialized.slice(4)}`) as unknown[];
  if (decoded.length !== 9) throw new Error("unexpected unsigned tx format");
  return serialized;
}

async function main() {
  const read = <T>(fn: (c: ReturnType<typeof createPublicClient>) => Promise<T>) => readWithFallback(fn);
  const [baseFeeScalar, blobBaseFeeScalar, l1BaseFee, blobBaseFee, gasPrice, feeHistory] = await Promise.all([
    read((c) => c.readContract({ address: GAS_PRICE_ORACLE, abi: GPO_ABI, functionName: "baseFeeScalar" }) as Promise<bigint>),
    read((c) => c.readContract({ address: GAS_PRICE_ORACLE, abi: GPO_ABI, functionName: "blobBaseFeeScalar" }) as Promise<bigint>),
    read((c) => c.readContract({ address: GAS_PRICE_ORACLE, abi: GPO_ABI, functionName: "l1BaseFee" })),
    read((c) => c.readContract({ address: GAS_PRICE_ORACLE, abi: GPO_ABI, functionName: "blobBaseFee" })),
    read((c) => c.getGasPrice()),
    read((c) => c.getFeeHistory({ blockCount: 1, blockTag: "latest" })),
  ]);
  const l2BaseFee = feeHistory.baseFeePerGas[0] ?? gasPrice - TIP_WEI;

  let ethUsd = Number(process.env.ETH_USD ?? 0);
  if (!ethUsd) {
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", { signal: AbortSignal.timeout(8000) });
      ethUsd = (await res.json()).ethereum.usd;
    } catch {
      ethUsd = 2700;
      console.error("ETH price fetch failed; using $2700 fallback");
    }
  }

  const shapes: { name: string; to: Hex; data: Hex; gas: bigint; l1Fee: bigint; rawLen: number; perItemDiv: number }[] = [];
  const standaloneData = standaloneCalldata("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  const standaloneTx = unsignedTx(USDC_BASE, standaloneData, BigInt(EXEC_GAS_STANDALONE));
  shapes.push({ name: "standalone transfer", to: USDC_BASE, data: standaloneData, gas: BigInt(EXEC_GAS_STANDALONE), l1Fee: 0n, rawLen: (standaloneTx.length - 2) / 2, perItemDiv: 1 });
  for (const n of BATCH_SIZES) {
    const data = batchCalldata(n);
    const tx = unsignedTx(BATCH_SENDER_PLACEHOLDER, data, BigInt(21_000 + n * EXEC_GAS_BATCH_PER_ITEM));
    shapes.push({ name: `batched (N=${n})`, to: BATCH_SENDER_PLACEHOLDER, data, gas: BigInt(21_000 + n * EXEC_GAS_BATCH_PER_ITEM), l1Fee: 0n, rawLen: (tx.length - 2) / 2, perItemDiv: n });
  }

  for (const s of shapes) {
    s.l1Fee = await read((c) =>
      c.readContract({
        address: GAS_PRICE_ORACLE,
        abi: GPO_ABI,
        functionName: "getL1Fee",
        args: [unsignedTx(s.to, s.data, s.gas)],
      }),
    );
    const ub = await read((c) =>
      c.readContract({
        address: GAS_PRICE_ORACLE,
        abi: GPO_ABI,
        functionName: "getL1FeeUpperBound",
        args: [BigInt(s.rawLen)],
      }),
    );
    if (s.l1Fee > ub) throw new Error(`fee exceeds upper bound for ${s.name}; serialization format wrong`);
  }

  const l1FeeScaled = BigInt(baseFeeScalar) * 16n * l1BaseFee + BigInt(blobBaseFeeScalar) * blobBaseFee;
  const effGasPrice = l2BaseFee + TIP_WEI;
  const usd = (wei: bigint) => Number(wei) / 1e18 * ethUsd;
  const perItem = (s: (typeof shapes)[number]) => ({ exec: s.gas * effGasPrice / BigInt(s.perItemDiv), l1: s.l1Fee / BigInt(s.perItemDiv) });

  console.log("# Gas cost analysis - Base mainnet");
  console.log(`_Generated ${new Date().toISOString()} from live RPCs (fallback chain: ${RPCS.join(", ")})_\n`);
  console.log("## Live parameters");
  console.log("| parameter | value |");
  console.log("|---|---|");
  console.log(`| L2 base fee | ${(Number(l2BaseFee) / 1e9).toFixed(6)} gwei |`);
  console.log(`| L2 effective gas price (base+${(Number(TIP_WEI) / 1e9).toFixed(4)} gwei tip) | ${(Number(effGasPrice) / 1e9).toFixed(6)} gwei |`);
  console.log(`| L1 base fee (relayed) | ${(Number(l1BaseFee) / 1e9).toFixed(4)} gwei |`);
  console.log(`| L1 blob base fee (relayed) | ${(Number(blobBaseFee) / 1e9).toFixed(4)} gwei |`);
  console.log(`| baseFeeScalar / blobBaseFeeScalar | ${baseFeeScalar} / ${blobBaseFeeScalar} |`);
  console.log(`| ETH price | $${ethUsd.toFixed(2)} |\n`);

  console.log("## Per-transfer cost, current conditions");
  console.log("| shape | exec gas | tx size (B) | L1 fee | exec fee | total | /day | /year |");
  console.log("|---|---|---|---|---|---|---|---|");
  const perRow: Record<string, { totalWei: bigint; l1PerItem: bigint; gasPerItem: bigint }> = {};
  for (const s of shapes) {
    const p = perItem(s);
    const total = p.exec + p.l1;
    perRow[s.name] = { totalWei: total, l1PerItem: p.l1, gasPerItem: s.gas / BigInt(s.perItemDiv) };
    console.log(
      `| ${s.name} | ${(Number(s.gas / BigInt(s.perItemDiv))).toLocaleString()} | ${s.rawLen} | $${usd(p.l1).toExponential(2)} | $${usd(p.exec).toFixed(6)} | $${usd(total).toFixed(6)} | $${(usd(total) * TRANSFERS_PER_DAY).toFixed(2)} | $${(usd(total) * TRANSFERS_PER_DAY * 365).toFixed(0)} |`,
    );
  }
  const st = perRow["standalone transfer"];
  const b256 = perRow["batched (N=256)"];
  const pct = (1 - Number(b256.totalWei) / Number(st.totalWei)) * 100;
  console.log(`\nBatching saves ${pct.toFixed(1)}% at current conditions (exec-dominated market).\n`);

  console.log("## Sensitivity: blob-fee regimes (per-transfer USD, N=256 batches)");
  console.log("| blob base fee | standalone: L1 / exec / total | batched: L1 / exec / total | saving | /day standalone vs batched |");
  console.log("|---|---|---|---|---|");
  const blobScenarios: [string, bigint][] = [
    ["today", blobBaseFee],
    ["0.5 gwei", 500_000_000n],
    ["2.3 gwei (Sept 2026 avg per blob analysts)", 2_300_000_000n],
    ["10 gwei", 10_000_000_000n],
    ["80 gwei (Nov 2024-style spike)", 80_000_000_000n],
  ];
  for (const [label, blobWei] of blobScenarios) {
    const scaled = BigInt(baseFeeScalar) * 16n * l1BaseFee + BigInt(blobBaseFeeScalar) * blobWei;
    const estPerItem = (l1PerItem: bigint) => (l1PerItem * 10n ** 12n) / l1FeeScaled;
    const stL1 = (estPerItem(st.l1PerItem) * scaled) / 10n ** 12n;
    const bL1 = (estPerItem(b256.l1PerItem) * scaled) / 10n ** 12n;
    const stTotal = stL1 + st.gasPerItem * effGasPrice;
    const bTotal = bL1 + b256.gasPerItem * effGasPrice;
    const daySt = usd(stTotal) * TRANSFERS_PER_DAY;
    const dayB = usd(bTotal) * TRANSFERS_PER_DAY;
    console.log(
      `| ${label} | $${usd(stL1).toFixed(5)} / $${usd(st.gasPerItem * effGasPrice).toFixed(5)} / $${usd(stTotal).toFixed(5)} | $${usd(bL1).toFixed(5)} / $${usd(b256.gasPerItem * effGasPrice).toFixed(5)} / $${usd(bTotal).toFixed(5)} | ${((1 - Number(bTotal) / Number(stTotal)) * 100).toFixed(0)}% | $${daySt.toFixed(0)} vs $${dayB.toFixed(0)} |`,
    );
  }

  console.log("\n## Sensitivity: L2 gas-price regimes (exec-only per transfer)");
  console.log("| L2 eff. gas price | standalone exec | batched exec | /day standalone vs batched |");
  console.log("|---|---|---|---|");
  for (const [label, gp] of [["today", effGasPrice], ["0.05 gwei", 50_000_000n], ["0.25 gwei", 250_000_000n]] as [string, bigint][]) {
    const daySt = usd(st.gasPerItem * gp) * TRANSFERS_PER_DAY;
    const dayB = usd(b256.gasPerItem * gp) * TRANSFERS_PER_DAY;
    console.log(
      `| ${label} (${(Number(gp) / 1e9).toFixed(4)} gwei) | $${usd(st.gasPerItem * gp).toFixed(5)} | $${usd(b256.gasPerItem * gp).toFixed(5)} | $${daySt.toFixed(0)} vs $${dayB.toFixed(0)} |`,
    );
  }

  console.log("\n## Assumptions");
  console.log(`- ERC-20 token transfer: ${EXEC_GAS_STANDALONE.toLocaleString()} gas standalone (forge-measured on OZ-style token, fresh recipient; real-world USDC on Base tracks 55-75k)`);
  console.log(`- Batched per-item: ${EXEC_GAS_BATCH_PER_ITEM.toLocaleString()} gas amortized at N=256 (forge-measured incl. calldata and intrinsic amortization)`);
  console.log("- L1 fees are exact: computed by the chain's own GasPriceOracle Fjord formula (fastLZ + scalars) on the serialized txs");
  console.log("- USDC on Base used as the reference token; recipients fresh/cold (payouts to new users)");
  console.log(`- ${TRANSFERS_PER_DAY.toLocaleString()} transfers/day, amounts fit uint96, single relayer wallet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
