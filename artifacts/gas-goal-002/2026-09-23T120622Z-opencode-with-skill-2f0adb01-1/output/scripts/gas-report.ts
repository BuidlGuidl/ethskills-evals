// Report for finance: sum the ledger produced by the running sender.
// Usage: node scripts/gas-report.ts [ledger.csv]

import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "data/ledger.csv";
const lines = readFileSync(path, "utf8").trim().split("\n");
const header = lines[0];
if (!header.startsWith("timestamp")) {
  console.error("ledger missing header");
  process.exit(1);
}

let payments = 0n;
let totalWei = 0n;
let totalUsd = 0;
let txs = 0;
const perDay = new Map<string, { wei: bigint; usd: number }>();

for (const line of lines.slice(1)) {
  const [ts, , count, , , , , total, usd] = line.split(",");
  txs++;
  payments += BigInt(count);
  totalWei += BigInt(total);
  totalUsd += Number(usd);
  const day = ts.slice(0, 10);
  const agg = perDay.get(day) ?? { wei: 0n, usd: 0 };
  agg.wei += BigInt(total);
  agg.usd += Number(usd);
  perDay.set(day, agg);
}

console.log(`transactions: ${txs}`);
console.log(`payments:     ${payments}`);
console.log(`total spend:  ${Number(totalWei) / 1e18} ETH (~$${totalUsd.toFixed(2)})`);
console.log(`avg per payment: ~$${(totalUsd / Number(payments)).toFixed(6)}`);
console.log("\nper-day:");
for (const [day, agg] of [...perDay].sort()) {
  console.log(`  ${day}: ${(Number(agg.wei) / 1e18).toFixed(6)} ETH  $${agg.usd.toFixed(2)}`);
}
