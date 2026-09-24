#!/usr/bin/env node

const DEFAULT_RPC_URL = "https://mainnet.base.org";
const ETH_USD_URL = "https://api.coinbase.com/v2/prices/ETH-USD/spot";
const TRANSFER_SELECTOR = "0xa9059cbb";

const rpcUrl = process.env.BASE_RPC_URL || DEFAULT_RPC_URL;
const transfersPerDay = Number(process.env.TRANSFERS_PER_DAY || 40_000);
const sampleSize = Number(process.env.SAMPLE_SIZE || 25);
const maxBlocks = Number(process.env.MAX_BLOCKS || 1_000);
const gasUsedFallback = BigInt(process.env.GAS_USED || 53_190);
const l1FeeFallbackWei = BigInt(process.env.L1_FEE_WEI || 3_257_712_044);
const txHashes = (process.env.TX_HASHES || "")
  .split(/[,\s]+/)
  .map((hash) => hash.trim())
  .filter(Boolean);

let rpcId = 1;

async function main() {
  const [gasPriceWei, baseFeeWei, ethUsd, samples] = await Promise.all([
    rpc("eth_gasPrice", []),
    latestBaseFee(),
    fetchEthUsd(),
    txHashes.length > 0 ? receiptsFor(txHashes) : sampleRecentErc20Transfers(),
  ]);

  const gasPrice = BigInt(gasPriceWei);
  const baseFee = BigInt(baseFeeWei);
  const gasUsed = samples.length > 0
    ? averageBigInt(samples.map((sample) => sample.gasUsed))
    : gasUsedFallback;
  const l1FeeWei = samples.length > 0
    ? averageBigInt(samples.map((sample) => sample.l1FeeWei))
    : l1FeeFallbackWei;
  const sampledEffectiveGasPriceWei = samples.length > 0
    ? averageBigInt(samples.map((sample) => sample.effectiveGasPriceWei))
    : gasPrice;
  const medianSampledEffectiveGasPriceWei = samples.length > 0
    ? medianBigInt(samples.map((sample) => sample.effectiveGasPriceWei))
    : gasPrice;

  const liveCost = costModel({ gasUsed, gasPriceWei: gasPrice, l1FeeWei, ethUsd, transfersPerDay });
  const sampledCost = costModel({
    gasUsed,
    gasPriceWei: sampledEffectiveGasPriceWei,
    l1FeeWei,
    ethUsd,
    transfersPerDay,
  });
  const medianSampledCost = costModel({
    gasUsed,
    gasPriceWei: medianSampledEffectiveGasPriceWei,
    l1FeeWei,
    ethUsd,
    transfersPerDay,
  });

  const output = {
    measuredAt: new Date().toISOString(),
    rpcUrl,
    assumptions: {
      transfersPerDay,
      sampleSize,
      maxBlocks,
      txHashes: txHashes.length,
      fallbackGasUsed: gasUsedFallback.toString(),
      fallbackL1FeeWei: l1FeeFallbackWei.toString(),
    },
    readings: {
      ethUsd,
      gasPriceWei: gasPrice.toString(),
      gasPriceGwei: weiToGwei(gasPrice),
      baseFeeWei: baseFee.toString(),
      baseFeeGwei: weiToGwei(baseFee),
      sampleSource: txHashes.length > 0 ? "TX_HASHES" : "recent transfer(address,uint256) transactions",
      sampleCount: samples.length,
      sampledAverageGasUsed: gasUsed.toString(),
      sampledAverageL1FeeWei: l1FeeWei.toString(),
      sampledAverageEffectiveGasPriceWei: sampledEffectiveGasPriceWei.toString(),
      sampledAverageEffectiveGasPriceGwei: weiToGwei(sampledEffectiveGasPriceWei),
      sampledMedianEffectiveGasPriceWei: medianSampledEffectiveGasPriceWei.toString(),
      sampledMedianEffectiveGasPriceGwei: weiToGwei(medianSampledEffectiveGasPriceWei),
    },
    costUsingLiveGasPrice: liveCost,
    costUsingSampledEffectiveGasPrice: sampledCost,
    costUsingSampledMedianEffectiveGasPrice: medianSampledCost,
    sampledTransactions: samples.slice(0, 10),
  };

  console.log(JSON.stringify(output, bigintReplacer, 2));
}

async function latestBaseFee() {
  const block = await rpc("eth_getBlockByNumber", ["latest", false]);
  return block.baseFeePerGas;
}

async function fetchEthUsd() {
  const response = await fetch(ETH_USD_URL);
  if (!response.ok) {
    throw new Error(`ETH/USD request failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  return Number(payload.data.amount);
}

async function sampleRecentErc20Transfers() {
  const latestHex = await rpc("eth_blockNumber", []);
  const latest = BigInt(latestHex);
  const matches = [];

  for (let blockNumber = latest; blockNumber > latest - BigInt(maxBlocks) && matches.length < sampleSize; blockNumber--) {
    const block = await rpc("eth_getBlockByNumber", [toQuantity(blockNumber), true]);
    for (const tx of block.transactions) {
      if (tx.input?.startsWith(TRANSFER_SELECTOR)) {
        matches.push(tx.hash);
        if (matches.length >= sampleSize) break;
      }
    }
  }

  return Promise.all(matches.map(async (hash) => {
    return receiptSample(hash);
  }));
}

async function receiptsFor(hashes) {
  return Promise.all(hashes.map((hash) => receiptSample(hash)));
}

async function receiptSample(hash) {
  const receipt = await rpc("eth_getTransactionReceipt", [hash]);
  return {
    hash,
    blockNumber: Number(BigInt(receipt.blockNumber)),
    gasUsed: BigInt(receipt.gasUsed),
    effectiveGasPriceWei: BigInt(receipt.effectiveGasPrice),
    l1FeeWei: BigInt(receipt.l1Fee || "0x0"),
    status: receipt.status,
  };
}

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
  });

  if (!response.ok) {
    throw new Error(`${method} failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`${method} failed: ${payload.error.message || JSON.stringify(payload.error)}`);
  }
  return payload.result;
}

function costModel({ gasUsed, gasPriceWei, l1FeeWei, ethUsd, transfersPerDay }) {
  const executionWei = gasUsed * gasPriceWei;
  const totalWei = executionWei + l1FeeWei;
  const ethPerTransfer = Number(totalWei) / 1e18;
  const usdPerTransfer = ethPerTransfer * ethUsd;

  return {
    executionWeiPerTransfer: executionWei.toString(),
    l1FeeWeiPerTransfer: l1FeeWei.toString(),
    totalWeiPerTransfer: totalWei.toString(),
    ethPerTransfer,
    usdPerTransfer,
    usdPerDay: usdPerTransfer * transfersPerDay,
    usdPerMonth30d: usdPerTransfer * transfersPerDay * 30,
    usdPerYear365d: usdPerTransfer * transfersPerDay * 365,
  };
}

function averageBigInt(values) {
  return values.reduce((sum, value) => sum + value, 0n) / BigInt(values.length);
}

function medianBigInt(values) {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)];
}

function weiToGwei(wei) {
  return Number(wei) / 1e9;
}

function toQuantity(value) {
  return `0x${value.toString(16)}`;
}

function bigintReplacer(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
