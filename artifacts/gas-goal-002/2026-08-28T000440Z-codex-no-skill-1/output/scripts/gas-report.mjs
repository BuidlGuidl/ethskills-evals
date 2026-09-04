#!/usr/bin/env node
/*
 * Dependency-free Base relayer fee report.
 * Usage: BASE_RPC_URL=https://mainnet.base.org node scripts/gas-report.mjs tx-hashes.txt
 * tx-hashes.txt: one transaction hash per line (blank lines and # comments are ignored).
 */
import { readFile } from "node:fs/promises";

const [input] = process.argv.slice(2);
const rpcUrl = process.env.BASE_RPC_URL;
if (!rpcUrl || !input) {
  console.error("Usage: BASE_RPC_URL=<Base RPC URL> node scripts/gas-report.mjs <tx-hashes.txt>");
  process.exit(1);
}

const hashes = [...new Set((await readFile(input, "utf8"))
  .split(/\r?\n/).map(line => line.replace(/#.*/, "").trim()).filter(Boolean))];
if (!hashes.length) throw new Error("No transaction hashes found");

let rpcId = 0;
async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}
const wei = hex => BigInt(hex ?? "0x0");
async function mapLimit(values, limit, fn) {
  const result = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) { const i = next++; result[i] = await fn(values[i]); }
  }));
  return result;
}

const receipts = await mapLimit(hashes, 8, async hash => {
  const receipt = await rpc("eth_getTransactionReceipt", [hash]);
  if (!receipt) throw new Error(`Receipt not found: ${hash}`);
  if (receipt.status !== "0x1") throw new Error(`Reverted transaction: ${hash}`);
  return { hash, gasUsed: wei(receipt.gasUsed), execution: wei(receipt.gasUsed) * wei(receipt.effectiveGasPrice), l1: wei(receipt.l1Fee), operator: wei(receipt.operatorFee) };
});

const sum = key => receipts.reduce((total, row) => total + row[key], 0n);
const execution = sum("execution"), l1 = sum("l1"), operator = sum("operator"), total = execution + l1 + operator;
const eth = value => `${(Number(value) / 1e18).toFixed(8)} ETH`;
console.log(`Transactions: ${receipts.length}`);
console.log(`Execution (gasUsed × effectiveGasPrice): ${eth(execution)}`);
console.log(`L1 data/security fee:                 ${eth(l1)}`);
console.log(`Operator fee:                         ${eth(operator)}`);
console.log(`TOTAL:                                ${eth(total)}`);
console.log(`Average per transaction:              ${eth(total / BigInt(receipts.length))}`);
console.log(`Average execution gas:                ${sum("gasUsed") / BigInt(receipts.length)} gas`);
if (l1 === 0n) console.log("WARNING: this RPC did not expose receipt.l1Fee; use a Base RPC that returns OP-stack fee fields before treating TOTAL as complete.");
