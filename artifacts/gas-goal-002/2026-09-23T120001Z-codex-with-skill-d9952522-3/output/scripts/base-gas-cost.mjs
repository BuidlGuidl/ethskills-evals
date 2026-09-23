#!/usr/bin/env node
import {
  buildBaseFeePolicy,
  calculateBatchSavings,
  calculateTransferCost,
  formatUsd,
  percentile,
  weiToGweiNumber
} from "../src/baseGasMath.mjs";

const DEFAULT_RPC_URL = "https://mainnet.base.org";
const DEFAULT_TOKEN = "0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";

const rpcUrl = process.env.BASE_RPC_URL || DEFAULT_RPC_URL;
const tokenAddress = process.env.TOKEN_ADDRESS || DEFAULT_TOKEN;
const transfersPerDay = BigInt(process.env.TRANSFERS_PER_DAY || "40000");
const sampleBlocks = BigInt(process.env.SAMPLE_BLOCKS || "250");
const sampleSize = Number(process.env.SAMPLE_SIZE || "25");
const sampleTxHashes = (process.env.SAMPLE_TX_HASHES || "")
  .split(",")
  .map((hash) => hash.trim())
  .filter(Boolean);
const batchedGasPerTransfer = BigInt(process.env.BATCHED_GAS_PER_TRANSFER || "44000");
const batchedL1FeePerTransferWei = BigInt(process.env.BATCHED_L1_FEE_PER_TRANSFER_WEI || "2100000000");

async function rpc(method, params = []) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
    });
    const body = await response.json();
    if (!body.error) {
      return body.result;
    }

    const message = body.error.message || JSON.stringify(body.error);
    if (!/rate|limit|429/i.test(message) || attempt === 4) {
      throw new Error(`${method}: ${message}`);
    }

    await sleep(300 * 2 ** attempt);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hexToBigInt(value) {
  return BigInt(value || "0x0");
}

async function fetchEthUsd() {
  const response = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
  if (!response.ok) {
    throw new Error(`Coinbase ETH/USD request failed: ${response.status}`);
  }
  const body = await response.json();
  return Number(body.data.amount);
}

async function sampleTransferReceipts() {
  const latestBlock = hexToBigInt(await rpc("eth_blockNumber"));

  if (sampleTxHashes.length > 0) {
    const receipts = [];
    for (const hash of sampleTxHashes.slice(0, sampleSize)) {
      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      receipts.push(receiptToSample(hash, receipt));
      await sleep(100);
    }

    return { latestBlock, fromBlock: latestBlock, receipts };
  }

  const fromBlock = latestBlock > sampleBlocks ? latestBlock - sampleBlocks : 0n;
  const logs = await rpc("eth_getLogs", [{
    address: tokenAddress,
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: `0x${latestBlock.toString(16)}`,
    topics: [TRANSFER_TOPIC]
  }]);

  const receipts = [];
  for (const log of logs) {
    if (receipts.length >= sampleSize) break;

    const [transaction, receipt] = await Promise.all([
      rpc("eth_getTransactionByHash", [log.transactionHash]),
      rpc("eth_getTransactionReceipt", [log.transactionHash])
    ]);

    if ((transaction.input || "").slice(0, 10) !== ERC20_TRANSFER_SELECTOR) {
      continue;
    }

    receipts.push(receiptToSample(log.transactionHash, receipt));
    await sleep(100);
  }

  if (receipts.length === 0) {
    throw new Error(`No plain ERC-20 transfer receipts found for ${tokenAddress}`);
  }

  return { latestBlock, fromBlock, receipts };
}

function receiptToSample(hash, receipt) {
  return {
    hash,
    blockNumber: hexToBigInt(receipt.blockNumber),
    gasUsed: hexToBigInt(receipt.gasUsed),
    effectiveGasPrice: hexToBigInt(receipt.effectiveGasPrice),
    l1Fee: hexToBigInt(receipt.l1Fee)
  };
}

function summarizeReceipts(receipts) {
  return {
    gasUsedP50: percentile(receipts.map((receipt) => receipt.gasUsed), 50),
    gasUsedP90: percentile(receipts.map((receipt) => receipt.gasUsed), 90),
    l1FeeP50: percentile(receipts.map((receipt) => receipt.l1Fee), 50),
    l1FeeP90: percentile(receipts.map((receipt) => receipt.l1Fee), 90)
  };
}

function printMoneyLine(label, cost) {
  console.log(`${label}: ${formatUsd(cost.dailyUsd)}/day, ${formatUsd(cost.monthlyUsd)}/30d, ${formatUsd(cost.annualUsd)}/yr`);
}

const [gasPriceHex, baseFeeHex, ethUsd, sample] = await Promise.all([
  rpc("eth_gasPrice"),
  rpc("eth_getBlockByNumber", ["latest", false]).then((block) => block.baseFeePerGas),
  fetchEthUsd(),
  sampleTransferReceipts()
]);

const gasPriceWei = hexToBigInt(gasPriceHex);
const baseFeeWei = hexToBigInt(baseFeeHex);
const feePolicy = buildBaseFeePolicy({ baseFeeWei, gasPriceWei });
const summary = summarizeReceipts(sample.receipts);

const measured = calculateTransferCost({
  gasUsed: summary.gasUsedP50,
  gasPriceWei,
  l1FeeWei: summary.l1FeeP50,
  ethUsd,
  transfersPerDay
});
const p90 = calculateTransferCost({
  gasUsed: summary.gasUsedP90,
  gasPriceWei,
  l1FeeWei: summary.l1FeeP90,
  ethUsd,
  transfersPerDay
});
const batching = calculateBatchSavings({
  directGasUsed: summary.gasUsedP50,
  batchedGasPerTransfer,
  gasPriceWei,
  directL1FeeWei: summary.l1FeeP50,
  batchedL1FeePerTransferWei,
  ethUsd,
  transfersPerDay
});

console.log(`Base RPC: ${rpcUrl}`);
console.log(`Token sampled: ${tokenAddress}`);
console.log(`Blocks sampled: ${sample.fromBlock}..${sample.latestBlock}; plain transfer receipts: ${sample.receipts.length}`);
console.log(`ETH/USD: ${formatUsd(ethUsd)}`);
console.log(`Gas price: ${gasPriceWei} wei (${weiToGweiNumber(gasPriceWei)} gwei)`);
console.log(`Base fee: ${baseFeeWei} wei (${weiToGweiNumber(baseFeeWei)} gwei)`);
console.log(`Fee policy: maxFeePerGas=${feePolicy.maxFeePerGas} wei, maxPriorityFeePerGas=${feePolicy.maxPriorityFeePerGas} wei`);
console.log(`Transfer gas p50/p90: ${summary.gasUsedP50}/${summary.gasUsedP90}`);
console.log(`L1 fee p50/p90: ${summary.l1FeeP50}/${summary.l1FeeP90} wei`);
printMoneyLine("Measured p50 direct transfers", measured);
printMoneyLine("Measured p90 direct transfers", p90);
printMoneyLine(`Batched estimate (${batchedGasPerTransfer} gas + ${batchedL1FeePerTransferWei} wei L1 each)`, batching.batched);
console.log(`Batched savings estimate: ${formatUsd(batching.savedUsdPerDay)}/day, ${formatUsd(batching.savedUsdPerYear)}/yr (${batching.savedPct.toFixed(1)}%)`);
