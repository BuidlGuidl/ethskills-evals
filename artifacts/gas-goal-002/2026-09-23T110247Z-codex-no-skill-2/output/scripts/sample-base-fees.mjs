#!/usr/bin/env node
import {
  asBigInt,
  feeHistorySummary,
  formatEth,
  formatUsd,
  jsonWithBigInts,
  percentile,
  rpc,
  toHex,
} from "../src/baseGas.mjs";

const url = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const token = (process.env.TOKEN_ADDRESS || "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913").toLowerCase();
const transferSelector = "0xa9059cbb";
const sampleSize = Number(process.env.SAMPLE_SIZE || "50");
const searchBlocks = BigInt(process.env.SEARCH_BLOCKS || "1000");
const ethUsd = Number(process.env.ETH_USD || "2746.43");

const latest = asBigInt(await rpc(url, "eth_blockNumber"));
const feeHistory = await feeHistorySummary(url);
const samples = [];

for (let blockNumber = latest; blockNumber > latest - searchBlocks && samples.length < sampleSize; blockNumber -= 1n) {
  const block = await rpc(url, "eth_getBlockByNumber", [toHex(blockNumber), true]);
  for (const tx of block.transactions) {
    if (tx.to?.toLowerCase() !== token || !tx.input?.toLowerCase().startsWith(transferSelector)) continue;
    const receipt = await rpc(url, "eth_getTransactionReceipt", [tx.hash]);
    const gasUsed = asBigInt(receipt.gasUsed);
    const effectiveGasPrice = asBigInt(receipt.effectiveGasPrice);
    const executionWei = gasUsed * effectiveGasPrice;
    const l1DataWei = asBigInt(receipt.l1Fee);
    samples.push({
      hash: tx.hash,
      blockNumber: Number(blockNumber),
      gasUsed,
      effectiveGasPrice,
      executionWei,
      l1DataWei,
      totalWei: executionWei + l1DataWei,
    });
    if (samples.length >= sampleSize) break;
  }
}

function average(items, field) {
  if (items.length === 0) return 0n;
  return items.reduce((sum, item) => sum + item[field], 0n) / BigInt(items.length);
}

function median(items, field) {
  if (items.length === 0) return 0n;
  const sorted = [...items].sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)][field];
}

const averageTotalWei = average(samples, "totalWei");
const medianTotalWei = median(samples, "totalWei");
const p90TotalWei = percentile(
  samples.map((sample) => sample.totalWei),
  90,
);
const output = {
  sampledAtBlock: Number(latest),
  token,
  sampleSize: samples.length,
  feeHistory,
  averages: {
    gasUsed: average(samples, "gasUsed"),
    effectiveGasPriceWei: average(samples, "effectiveGasPrice"),
    executionWei: average(samples, "executionWei"),
    l1DataWei: average(samples, "l1DataWei"),
    totalWei: averageTotalWei,
    totalEth: formatEth(averageTotalWei, 12),
    usdPerTransfer: formatUsd(averageTotalWei, ethUsd),
    usdPerDayAt40000Transfers: formatUsd(averageTotalWei * 40_000n, ethUsd),
    usdPerYearAt40000Transfers: formatUsd(averageTotalWei * 40_000n * 365n, ethUsd),
  },
  medians: {
    gasUsed: median(samples, "gasUsed"),
    effectiveGasPriceWei: median(samples, "effectiveGasPrice"),
    totalWei: medianTotalWei,
    totalEth: formatEth(medianTotalWei, 12),
    usdPerTransfer: formatUsd(medianTotalWei, ethUsd),
    usdPerDayAt40000Transfers: formatUsd(medianTotalWei * 40_000n, ethUsd),
    usdPerYearAt40000Transfers: formatUsd(medianTotalWei * 40_000n * 365n, ethUsd),
  },
  p90: {
    totalWei: p90TotalWei,
    totalEth: formatEth(p90TotalWei, 12),
    usdPerTransfer: formatUsd(p90TotalWei, ethUsd),
  },
  ethUsd,
};

console.log(jsonWithBigInts(output));
