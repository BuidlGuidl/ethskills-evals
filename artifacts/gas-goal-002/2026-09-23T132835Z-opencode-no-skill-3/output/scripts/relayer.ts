import { createWalletClient, decodeEventLog, http, publicActions, serializeTransaction, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { appendFileSync, readFileSync, statSync } from "node:fs";
import {
  BATCH_SENDER_ABI,
  GAS_PRICE_ORACLE,
  MAX_BATCH,
  USDC_BASE,
  basePublicClient,
  chunk,
  encodeSend,
  groupByToken,
  packItem,
  type Payout,
} from "../src/pack.ts";

const GPO_ABI = [
  { type: "function", name: "getL1Fee", inputs: [{ name: "data", type: "bytes" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "blobBaseFee", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

const USDC_ABI = [
  { type: "function", name: "isBlacklisted", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
] as const;

const PER_ITEM_GAS = 26_700n;
const TX_FIXED_GAS = 24_000n;

function parseArgs(argv: string[]) {
  const a: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        a[argv[i].slice(2)] = next;
        i++;
      } else a[argv[i].slice(2)] = true;
    }
  }
  return {
    queue: String(a.queue ?? "queue.jsonl"),
    contract: a.contract ? (String(a.contract) as Hex) : undefined,
    rpc: String(a.rpc ?? process.env.BASE_RPC ?? "https://base.publicnode.com"),
    key: String(a.key ?? process.env.RELAYER_KEY ?? ""),
    batchSize: Number(a["batch-size"] ?? 250),
    strict: a.strict === true,
    dryRun: a["dry-run"] === true,
    tipGwei: Number(a["tip-gwei"] ?? 0.001),
    maxGasGwei: Number(a["max-gas-gwei"] ?? 0.25),
    maxBlobFeeGwei: Number(a["max-blob-fee-gwei"] ?? 2.0),
    slaMinutes: Number(a["sla-minutes"] ?? 120),
    ledger: String(a.ledger ?? "ledger.jsonl"),
    remaining: String(a.remaining ?? "remaining.jsonl"),
    ethUsd: Number(a["eth-usd"] ?? 0),
    precheckUsdc: a["precheck-usdc"] === true,
  };
}

function usage() {
  console.log(`usage: tsx scripts/relayer.ts --queue queue.jsonl [options]

options:
  --key <hex> | $RELAYER_KEY    relayer private key (required to send, not for --dry-run)
  --contract <addr>             deployed BatchSender address (required to send)
  --rpc <url>                   Base RPC (default https://base.publicnode.com)
  --batch-size <n>              items per tx, 1..256 (default 250)
  --strict                      atomic send(): whole batch reverts on one bad item (default: sendSafe per-item tolerance)
  --tip-gwei <x>                priority fee in gwei (default 0.001)
  --max-gas-gwei <x>            defer while L2 base fee above this (default 0.25)
  --max-blob-fee-gwei <x>       defer while L1 blob base fee above this (default 2.0)
  --sla-minutes <n>             flush anyway when queue older than this (default 120)
  --precheck-usdc               drop blacklisted USDC recipients pre-flight
  --dry-run                     print the batch plan with exact L1 fees, send nothing
  --ledger <file>               cost ledger to append (default ledger.jsonl)
  --remaining <file>            requeue target for failed items (default remaining.jsonl)`);
}

function readQueue(path: string): Payout[] {
  const payouts: Payout[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const j = JSON.parse(line);
    payouts.push({ token: (j.token ?? USDC_BASE) as Hex, to: j.to, amount: BigInt(j.amount) });
  }
  return payouts;
}

function calldataGas(data: Hex): bigint {
  let g = 0n;
  for (const b of Buffer.from(data.slice(2), "hex")) g += b === 0 ? 4n : 16n;
  return g;
}

function estimateBatchGas(data: Hex, n: number): bigint {
  return TX_FIXED_GAS + calldataGas(data) + (BigInt(n) * PER_ITEM_GAS * 11n) / 10n;
}

function gwei(x: number): bigint {
  return BigInt(Math.round(x * 1e9));
}

async function ethPrice(fallback: number): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      signal: AbortSignal.timeout(8000),
    });
    return (await res.json()).ethereum.usd;
  } catch {
    return fallback;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fn: "send" | "sendSafe" = args.strict ? "send" : "sendSafe";
  if (args.batchSize < 1 || args.batchSize > Number(MAX_BATCH)) {
    throw new Error(`batch size must be 1..${MAX_BATCH}`);
  }
  if (!args.dryRun && (!args.key || !args.contract)) {
    usage();
    process.exit(1);
  }

  const client = basePublicClient(args.rpc).extend(publicActions);
  let payouts = readQueue(args.queue);
  if (payouts.length === 0) {
    console.log("queue empty");
    return;
  }

  if (args.precheckUsdc) {
    const idx = payouts
      .map((p, i) => (p.token.toLowerCase() === USDC_BASE.toLowerCase() ? i : -1))
      .filter((i) => i >= 0);
    const results = await client.readContracts({
      contracts: idx.map((i) => ({
        address: USDC_BASE,
        abi: USDC_ABI,
        functionName: "isBlacklisted" as const,
        args: [payouts[i].to] as const,
      })),
      allowFailure: true,
    });
    const bad = new Set(idx.filter((_, k) => results[k].status === "success" && results[k].result === true));
    if (bad.size > 0) {
      console.log(`precheck-usdc: dropping ${bad.size} blacklisted recipients`);
      payouts = payouts.filter((_, i) => !bad.has(i));
    }
  }

  const batches: { token: Hex; items: Hex[]; payouts: Payout[]; data: Hex; gas: bigint }[] = [];
  for (const [token, list] of groupByToken(payouts)) {
    for (const part of chunk(list, args.batchSize)) {
      const items = part.map((p) => packItem(p.to, p.amount));
      const data = encodeSend(fn, token, items);
      batches.push({ token, items, payouts: part, data, gas: estimateBatchGas(data, part.length) });
    }
  }

  const [gasPrice, feeHistory, blobBaseFee] = await Promise.all([
    client.getGasPrice(),
    client.getFeeHistory({ blockCount: 1, blockTag: "latest" }),
    client.readContract({ address: GAS_PRICE_ORACLE, abi: GPO_ABI, functionName: "blobBaseFee" }),
  ]);
  const baseFee = feeHistory.baseFeePerGas[0] ?? gasPrice - gwei(args.tipGwei);
  const tip = gwei(args.tipGwei);
  const queueAgeMin = (Date.now() - statSync(args.queue).mtimeMs) / 60000;
  const ethUsd = args.ethUsd || (await ethPrice(2700));
  const usd = (wei: bigint) => (Number(wei) / 1e18) * ethUsd;

  console.log(
    `relayer: ${payouts.length} payouts -> ${batches.length} txs (mode=${fn}, N<=${args.batchSize}) | base ${Number(baseFee) / 1e9} gwei, blob ${Number(blobBaseFee) / 1e9} gwei, ETH $${ethUsd}, queue age ${queueAgeMin.toFixed(0)}m`,
  );

  const gasTooHigh = baseFee > gwei(args.maxGasGwei);
  const blobTooHigh = blobBaseFee > gwei(args.maxBlobFeeGwei);
  if ((gasTooHigh || blobTooHigh) && queueAgeMin < args.slaMinutes) {
    console.log(
      `deferred: ${gasTooHigh ? "L2 gas above ceiling" : ""}${blobTooHigh ? " blob fee above ceiling" : ""}; queue untouched (SLA ${args.slaMinutes}m)`,
    );
    return;
  }
  if (gasTooHigh || blobTooHigh) console.log("SLA reached: sending despite fee ceilings");

  const l1FeeFor = async (to: Hex, data: Hex, gas: bigint, nonce: bigint, maxFee: bigint, prio: bigint) =>
    client.readContract({
      address: GAS_PRICE_ORACLE,
      abi: GPO_ABI,
      functionName: "getL1Fee",
      args: [
        serializeTransaction({
          type: "eip1559",
          chainId: 8453,
          nonce,
          gas,
          maxFeePerGas: maxFee,
          maxPriorityFeePerGas: prio,
          to,
          value: 0n,
          data,
        }),
      ],
    });

  const placeholder = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Hex;
  let planned = 0n;
  for (const b of batches) {
    const n = b.items.length;
    const maxFee = (baseFee * 12n) / 10n + tip;
    const l1Fee = await l1FeeFor(args.contract ?? placeholder, b.data, b.gas, 0n, maxFee, tip);
    const cost = b.gas * (baseFee + tip) + l1Fee;
    planned += cost;
    console.log(
      `plan: ${n} items, ${b.data.length / 2 - 1} B calldata, gas ~${b.gas}, L1 fee ${l1Fee} wei, est $${usd(cost).toFixed(4)} ($${(usd(cost) / n).toFixed(6)}/item)`,
    );
  }
  console.log(`planned total: $${usd(planned).toFixed(2)} for ${payouts.length} transfers (${batches.length} txs)`);
  if (args.dryRun) return;

  const account = privateKeyToAccount((args.key.startsWith("0x") ? args.key : `0x${args.key}`) as Hex);
  const wallet = createWalletClient({ account, chain: base, transport: http(args.rpc) });
  const remaining: string[] = [];
  let paidTotal = 0n;
  for (const b of batches) {
    const n = b.items.length;
    const nonce = await client.getTransactionCount({ address: account.address });
    const maxFee = (baseFee * 12n) / 10n + tip;
    const hash = await wallet.sendTransaction({
      to: args.contract!,
      data: b.data,
      gas: b.gas,
      nonce,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: tip,
      type: "eip1559",
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      console.log(`tx ${hash} reverted: requeueing ${n} items`);
      remaining.push(...b.payouts);
      continue;
    }
    const execPaid = receipt.gasUsed * receipt.effectiveGasPrice;
    const l1Paid = await l1FeeFor(args.contract!, b.data, b.gas, BigInt(nonce), maxFee, tip);
    const paid = execPaid + l1Paid;
    paidTotal += paid;
    let failedCount = 0;
    for (const log of receipt.logs) {
      try {
        const dec = decodeEventLog({ abi: BATCH_SENDER_ABI, data: log.data, topics: log.topics });
        if (dec.eventName === "Failures") {
          const bitmap = dec.args.bitmap as bigint;
          failedCount = bitmap.toString(2).split("").filter((c) => c === "1").length;
          const failedIdx = bitmap
            .toString(2)
            .padStart(n, "0")
            .split("")
            .map((c, i) => (c === "1" ? n - 1 - i : -1))
            .filter((i) => i >= 0);
          remaining.push(...failedIdx.map((i) => b.payouts[i]).filter(Boolean));
          console.log(`sendSafe: ${failedCount}/${n} items failed (requeued)`);
        }
      } catch {
        continue;
      }
    }
    const entry = {
      ts: new Date().toISOString(),
      hash,
      token: b.token,
      items: n,
      gasUsed: receipt.gasUsed.toString(),
      execFeeWei: execPaid.toString(),
      l1FeeWei: l1Paid.toString(),
      usd: +usd(paid).toFixed(6),
      perItemUsd: +(usd(paid) / n).toFixed(8),
      failedItems: failedCount,
    };
    appendFileSync(args.ledger, JSON.stringify(entry) + "\n");
    console.log(
      `sent ${hash} | gasUsed ${receipt.gasUsed} | paid $${usd(paid).toFixed(4)} ($${(usd(paid) / n).toFixed(6)}/item) | logged to ${args.ledger}`,
    );
  }
  if (remaining.length > 0) {
    appendFileSync(args.remaining, remaining.map((p) => JSON.stringify({ token: p.token, to: p.to, amount: p.amount.toString() })).join("\n") + "\n");
    console.log(`${remaining.length} items requeued to ${args.remaining}`);
  }
  console.log(`done: ${payouts.length - remaining.length} transfers paid, $${usd(paidTotal).toFixed(2)} spent`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
