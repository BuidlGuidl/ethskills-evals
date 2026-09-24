#!/usr/bin/env node
import { formatGwei, jsonWithBigInts, suggestBaseFeeCaps } from "../src/baseGas.mjs";

const url = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const blocks = Number(process.env.FEE_HISTORY_BLOCKS || "100");
const baseFeeMultiplier = BigInt(process.env.BASE_FEE_MULTIPLIER || "2");
const minPriorityFeeWei = BigInt(process.env.MIN_PRIORITY_FEE_WEI || "1000000");

const caps = await suggestBaseFeeCaps(url, {
  blocks,
  baseFeeMultiplier,
  minPriorityFeeWei,
});

console.log(
  jsonWithBigInts({
    ...caps,
    maxPriorityFeePerGasGwei: formatGwei(caps.maxPriorityFeePerGas),
    maxFeePerGasGwei: formatGwei(caps.maxFeePerGas),
    latestBaseFeeGwei: formatGwei(caps.latestBaseFeeWei),
    p90PriorityFeeGwei: formatGwei(caps.p90PriorityFeeWei),
  }),
);
