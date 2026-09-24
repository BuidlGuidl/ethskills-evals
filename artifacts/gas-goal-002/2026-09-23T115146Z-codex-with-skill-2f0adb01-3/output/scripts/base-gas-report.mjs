#!/usr/bin/env node
import {
  BASE_RPC_URL,
  BASE_USDC_ADDRESS,
  conservativeDailyBaseline,
  fetchBaseFeeSnapshot,
  fetchEthUsd,
  sampleRecentTokenTransfers,
  summarizeTransferSamples,
} from "../src/baseGasData.mjs";
import { DEFAULT_ERC20_TRANSFER_GAS, DEFAULT_TRANSFERS_PER_DAY, estimateBatchSavings } from "../src/gasMath.mjs";
import { buildBaseFeeOverrides } from "../src/feePolicy.mjs";

const rpcUrl = process.env.BASE_RPC_URL ?? BASE_RPC_URL;
const tokenAddress = process.env.TOKEN_ADDRESS ?? BASE_USDC_ADDRESS;
const transfersPerDay = Number(process.env.TRANSFERS_PER_DAY ?? DEFAULT_TRANSFERS_PER_DAY);
const sampleLimit = Number(process.env.SAMPLE_LIMIT ?? 20);

const [feeSnapshot, ethUsd, samples] = await Promise.all([
  fetchBaseFeeSnapshot({ rpcUrl }),
  fetchEthUsd(),
  sampleRecentTokenTransfers({ rpcUrl, tokenAddress, limit: sampleLimit }),
]);

const sampleSummary = summarizeTransferSamples(samples, ethUsd);
const l1FeeWei = sampleSummary ? BigInt(Math.round(sampleSummary.averageL1FeeWei)) : 0n;
const baseline = conservativeDailyBaseline({
  gasPriceWei: feeSnapshot.gasPriceWei,
  ethUsd,
  transfersPerDay,
  gasUsed: DEFAULT_ERC20_TRANSFER_GAS,
  l1FeeWei,
});
const batch = estimateBatchSavings({
  transfersPerDay,
  gasPriceWei: feeSnapshot.gasPriceWei,
  ethUsd,
  l1FeeWeiPerTransfer: l1FeeWei,
});
const feePolicy = buildBaseFeeOverrides({
  baseFeeWei: feeSnapshot.baseFeeWei,
  priorityFeeWei: feeSnapshot.priorityFeeP50Wei,
});

const report = {
  collectedAt: new Date().toISOString(),
  rpcUrl,
  tokenAddress,
  transfersPerDay,
  ethUsd,
  feeSnapshot: {
    gasPriceGwei: Number(feeSnapshot.gasPriceWei) / 1e9,
    baseFeeGwei: Number(feeSnapshot.baseFeeWei) / 1e9,
    priorityFeeP50Gwei: Number(feeSnapshot.priorityFeeP50Wei) / 1e9,
  },
  sampleSummary,
  conservativeBaseline: baseline,
  estimatedBatchSavings: batch,
  feePolicy: {
    shouldSubmit: feePolicy.shouldSubmit,
    reason: feePolicy.reason,
    maxFeePerGasGwei: Number(feePolicy.maxFeePerGas) / 1e9,
    maxPriorityFeePerGasGwei: Number(feePolicy.maxPriorityFeePerGas) / 1e9,
  },
};

console.log(JSON.stringify(report, null, 2));
