#!/usr/bin/env node

const DEFAULT_RPC_URL = "https://mainnet.base.org";
const DEFAULT_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TRANSFER_SELECTOR = "0xa9059cbb";
const FALLBACK_TRANSFER_GAS = 65000n;
const FALLBACK_BATCH_SAVINGS_GAS = 18000n;

const config = {
  rpcUrl: process.env.BASE_RPC_URL || DEFAULT_RPC_URL,
  token: (process.env.TOKEN_ADDRESS || DEFAULT_TOKEN).toLowerCase(),
  transfersPerDay: Number(process.env.TRANSFERS_PER_DAY || 40000),
  lookbackBlocks: BigInt(process.env.LOOKBACK_BLOCKS || 1200),
  sampleSize: Number(process.env.SAMPLE_SIZE || 20),
  fallbackEthUsd: Number(process.env.ETH_USD || 2726.39),
  batchSavingsGas: BigInt(
    process.env.BATCH_SAVINGS_GAS_PER_TRANSFER || FALLBACK_BATCH_SAVINGS_GAS,
  ),
  markdown: process.argv.includes("--markdown"),
};

function hexToBigInt(value) {
  return BigInt(value || "0x0");
}

function weiToGwei(wei) {
  return Number(wei) / 1e9;
}

function usdFromGas(gas, gasPriceWei, ethUsd) {
  return (Number(gas * gasPriceWei) / 1e18) * ethUsd;
}

function topicToAddress(topic) {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function pad32Hex(value) {
  return value.replace(/^0x/, "").padStart(64, "0");
}

function encodeTransfer(to, amount) {
  return `${TRANSFER_SELECTOR}${pad32Hex(to)}${amount.toString(16).padStart(64, "0")}`;
}

function median(values) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rpc(method, params = []) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(config.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });

    if (response.status === 429) {
      await sleep(500 * (attempt + 1));
      continue;
    }

    if (!response.ok) {
      throw new Error(`${method} failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload.error?.message?.toLowerCase().includes("rate limit")) {
      await sleep(500 * (attempt + 1));
      continue;
    }
    if (payload.error) {
      throw new Error(`${method} failed: ${payload.error.message}`);
    }

    return payload.result;
  }

  throw new Error(`${method} failed: over rate limit`);
}

async function rpcBatch(calls) {
  if (calls.length === 0) return [];

  const results = [];
  for (let offset = 0; offset < calls.length; offset += 5) {
    results.push(...await rpcBatchChunk(calls.slice(offset, offset + 5)));
    await sleep(250);
  }
  return results;
}

async function rpcBatchChunk(calls) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(config.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        calls.map((call, index) => ({
          jsonrpc: "2.0",
          id: index + 1,
          method: call.method,
          params: call.params,
        })),
      ),
    });

    if (response.status === 429) {
      await sleep(500 * (attempt + 1));
      continue;
    }

    if (!response.ok) {
      throw new Error(`batch RPC failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : [payload];
    const rateLimited = items.some((item) =>
      item.error?.message?.toLowerCase().includes("rate limit")
    );
    if (rateLimited) {
      await sleep(500 * (attempt + 1));
      continue;
    }

    return items
      .sort((a, b) => a.id - b.id)
      .map((item) => {
        if (item.error) throw new Error(`batch RPC failed: ${item.error.message}`);
        return item.result;
      });
  }

  throw new Error("batch RPC failed: over rate limit");
}

async function fetchEthUsd() {
  if (process.env.ETH_USD) return config.fallbackEthUsd;

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { headers: { accept: "application/json" } },
    );
    const payload = await response.json();
    return Number(payload.ethereum.usd) || config.fallbackEthUsd;
  } catch {
    return config.fallbackEthUsd;
  }
}

async function sampleSimpleTransfers(latestBlock) {
  let lookback = config.lookbackBlocks;
  let logs = [];
  let lastError;

  while (lookback >= 25n) {
    const fromBlock = latestBlock > lookback ? latestBlock - lookback : 0n;

    try {
      logs = await rpc("eth_getLogs", [
        {
          address: config.token,
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: "latest",
          topics: [TRANSFER_TOPIC],
        },
      ]);
      break;
    } catch (error) {
      lastError = error;
      lookback /= 2n;
    }
  }

  if (logs.length === 0 && lastError) {
    throw lastError;
  }

  const estimatedTransferGas = await estimatePlainTransferGas(logs);

  const hashes = [...new Set(logs.map((log) => log.transactionHash))]
    .slice(0, config.sampleSize * 3);
  const txs = await rpcBatch(
    hashes.map((hash) => ({ method: "eth_getTransactionByHash", params: [hash] })),
  );
  const simpleHashes = txs
    .filter((tx) => {
      if (!tx) return false;
      return (
        tx.to?.toLowerCase() === config.token &&
        tx.input?.toLowerCase().startsWith(TRANSFER_SELECTOR)
      );
    })
    .map((tx) => tx.hash)
    .slice(0, config.sampleSize);

  const receipts = await rpcBatch(
    simpleHashes.map((hash) => ({ method: "eth_getTransactionReceipt", params: [hash] })),
  );

  const gasUsed = receipts
    .filter((receipt) => receipt?.status === "0x1")
    .map((receipt) => hexToBigInt(receipt.gasUsed));

  if (gasUsed.length < 5 && estimatedTransferGas) {
    return {
      count: gasUsed.length,
      medianGasUsed: estimatedTransferGas,
      gasSource: "eth_estimateGas from recent Transfer holder",
    };
  }

  return {
    count: gasUsed.length,
    medianGasUsed: median(gasUsed) || FALLBACK_TRANSFER_GAS,
    gasSource: gasUsed.length > 0 ? "recent simple transfer receipts" : "fallback default",
  };
}

async function estimatePlainTransferGas(logs) {
  const candidates = logs
    .map((log) => ({
      from: topicToAddress(log.topics[1]),
      to: topicToAddress(log.topics[2]),
    }))
    .filter((candidate) => {
      return (
        candidate.from !== "0x0000000000000000000000000000000000000000" &&
        candidate.to !== "0x0000000000000000000000000000000000000000"
      );
    })
    .slice(0, 20);

  for (const candidate of candidates) {
    try {
      return hexToBigInt(
        await rpc("eth_estimateGas", [
          {
            from: candidate.from,
            to: config.token,
            data: encodeTransfer(candidate.to, 1n),
            value: "0x0",
          },
        ]),
      );
    } catch {
      // Try the next recent holder; some may be contracts or empty by the time we estimate.
    }
  }

  return undefined;
}

function money(value) {
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 100) return `$${value.toFixed(2)}`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function markdown(report) {
  return [
    `# Base Gas Report`,
    ``,
    `Generated: ${report.generatedAt}`,
    ``,
    `| Metric | Value |`,
    `| --- | ---: |`,
    `| Transfers/day | ${report.transfersPerDay.toLocaleString("en-US")} |`,
    `| ETH/USD | ${money(report.ethUsd)} |`,
    `| Base gas price | ${report.gasPriceGwei.toFixed(6)} gwei |`,
    `| Sampled simple transfers | ${report.sampledTransfers} |`,
    `| Transfer gas source | ${report.transferGasSource} |`,
    `| Median ERC-20 transfer gas | ${report.transferGas.toLocaleString("en-US")} |`,
    `| Current cost / transfer | ${money(report.costPerTransferUsd)} |`,
    `| Current cost / day | ${money(report.dailyCostUsd)} |`,
    `| Current cost / 30-day month | ${money(report.monthlyCostUsd)} |`,
    `| Batch savings assumption | ${report.batchSavingsGas.toLocaleString("en-US")} gas/transfer |`,
    `| Batch cost / day | ${money(report.batchDailyCostUsd)} |`,
    `| Batch savings / day | ${money(report.batchDailySavingsUsd)} |`,
    `| Batch savings / 30-day month | ${money(report.batchMonthlySavingsUsd)} |`,
    ``,
  ].join("\n");
}

async function main() {
  const [latestBlockHex, gasPriceHex, feeHistory, ethUsd] = await Promise.all([
    rpc("eth_blockNumber"),
    rpc("eth_gasPrice"),
    rpc("eth_feeHistory", ["0x14", "latest", [10, 50, 90]]),
    fetchEthUsd(),
  ]);

  const latestBlock = hexToBigInt(latestBlockHex);
  const gasPriceWei = hexToBigInt(gasPriceHex);
  const transferSample = await sampleSimpleTransfers(latestBlock);
  const transferGas = transferSample.medianGasUsed;
  const batchGas = transferGas > config.batchSavingsGas
    ? transferGas - config.batchSavingsGas
    : transferGas;

  const costPerTransferUsd = usdFromGas(transferGas, gasPriceWei, ethUsd);
  const batchCostPerTransferUsd = usdFromGas(batchGas, gasPriceWei, ethUsd);
  const dailyCostUsd = costPerTransferUsd * config.transfersPerDay;
  const batchDailyCostUsd = batchCostPerTransferUsd * config.transfersPerDay;

  const report = {
    generatedAt: new Date().toISOString(),
    rpcUrl: config.rpcUrl,
    token: config.token,
    transfersPerDay: config.transfersPerDay,
    latestBlock: latestBlock.toString(),
    ethUsd,
    gasPriceWei: gasPriceWei.toString(),
    gasPriceGwei: weiToGwei(gasPriceWei),
    latestBaseFeeGwei: weiToGwei(hexToBigInt(feeHistory.baseFeePerGas.at(-1))),
    transferGas: Number(transferGas),
    transferGasSource: transferSample.gasSource,
    sampledTransfers: transferSample.count,
    costPerTransferUsd,
    dailyCostUsd,
    monthlyCostUsd: dailyCostUsd * 30,
    batchSavingsGas: Number(config.batchSavingsGas),
    batchGas: Number(batchGas),
    batchCostPerTransferUsd,
    batchDailyCostUsd,
    batchMonthlyCostUsd: batchDailyCostUsd * 30,
    batchDailySavingsUsd: dailyCostUsd - batchDailyCostUsd,
    batchMonthlySavingsUsd: (dailyCostUsd - batchDailyCostUsd) * 30,
  };

  if (config.markdown) {
    console.log(markdown(report));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
