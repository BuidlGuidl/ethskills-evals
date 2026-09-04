#!/usr/bin/env node

// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
// The input is one Base transaction hash per line. Export these from the
// relayer database; public Base RPCs cannot efficiently query by sender.
import { readFile } from "node:fs/promises";

const hashesFile = process.argv[2];
if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
const hashes = (await readFile(hashesFile, "utf8"))
  .split(/\s+/)
  .filter(Boolean)
  .filter((hash, index, all) => all.indexOf(hash) === index);
if (hashes.length === 0) throw new Error("No transaction hashes found");

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
  return payload.result;
}

const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
const ethUsd = Number((await priceResponse.json()).data.amount);
const receipts = [];
// Keep requests bounded so this can run against conservative public RPC limits.
for (let i = 0; i < hashes.length; i += 20) {
  const group = hashes.slice(i, i + 20);
  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
}

let executionWei = 0n;
let l1Wei = 0n;
for (let i = 0; i < receipts.length; ++i) {
  const receipt = receipts[i];
  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
  // so a provider schema change cannot silently be mistaken for a saving.
  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
}
const totalWei = executionWei + l1Wei;
const weiToEth = (value) => Number(value) / 1e18;
const usd = (value) => weiToEth(value) * ethUsd;
console.log(JSON.stringify({
  chainId: 8453,
  transactions: receipts.length,
  ethUsd,
  executionWei: executionWei.toString(),
  l1DataWei: l1Wei.toString(),
  totalWei: totalWei.toString(),
  executionUsd: usd(executionWei),
  l1DataUsd: usd(l1Wei),
  totalUsd: usd(totalWei),
  averageUsdPerTransaction: usd(totalWei) / receipts.length,
  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
}, null, 2));
