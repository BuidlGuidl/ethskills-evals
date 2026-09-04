#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { receiptCostWei } from "./base-fees.mjs";

const [file, ethUsdText] = process.argv.slice(2);
if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
  process.exit(1);
}
const parsed = JSON.parse(await readFile(file, "utf8"));
const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
const ethUsd = Number(ethUsdText);
let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
for (const receipt of receipts) {
  const cost = receiptCostWei(receipt);
  executionWei += cost.executionWei;
  l1FeeWei += cost.l1FeeWei;
  gasUsed += BigInt(receipt.gasUsed);
}
const totalWei = executionWei + l1FeeWei;
const usd = wei => Number(wei) / 1e18 * ethUsd;
const n = BigInt(receipts.length);
console.log(JSON.stringify({
  transfers: receipts.length,
  averageGasUsed: (gasUsed / n).toString(),
  averageExecutionWei: (executionWei / n).toString(),
  averageL1FeeWei: (l1FeeWei / n).toString(),
  averageTotalWei: (totalWei / n).toString(),
  totalUsd: usd(totalWei),
  averageUsd: usd(totalWei) / receipts.length,
  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
}, null, 2));
