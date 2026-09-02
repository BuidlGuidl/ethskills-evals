#!/usr/bin/env node
/**
 * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
 * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
 */
import { readFile } from "node:fs/promises";

const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");

const hashes = (await readFile(file, "utf8"))
  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
if (!hashes.length) throw new Error("No valid transaction hashes found");

let nextId = 1;
async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
  return body.result;
}

const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
)).json()).data.amount);
if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");

const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");

let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
for (const receipt of receipts) {
  const used = BigInt(receipt.gasUsed);
  gasUsed += used;
  l2Wei += used * BigInt(receipt.effectiveGasPrice);
  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
}
const totalWei = l2Wei + l1Wei;
const usd = Number(totalWei) / 1e18 * ethUsd;
// Base fees are commonly below 1 gwei; nine decimals would hide the L1 component.
const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(12);
console.log(JSON.stringify({
  transactions: hashes.length, gasUsed: gasUsed.toString(),
  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
}, null, 2));
