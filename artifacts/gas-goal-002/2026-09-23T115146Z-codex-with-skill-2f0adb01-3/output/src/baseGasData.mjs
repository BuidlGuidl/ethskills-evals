import {
  DEFAULT_ERC20_TRANSFER_GAS,
  DEFAULT_TRANSFERS_PER_DAY,
  transferCostUsd,
  volumeCostUsd,
} from "./gasMath.mjs";

export const BASE_RPC_URL = "https://mainnet.base.org";
export const BASE_USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const TRANSFER_SELECTOR = "0xa9059cbb";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function rpcCall(rpcUrl, method, params = []) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });

    if (response.ok) {
      const payload = await response.json();
      if (payload.error) throw new Error(`${method} failed: ${JSON.stringify(payload.error)}`);
      return payload.result;
    }

    if (response.status !== 429 || attempt === 2) {
      throw new Error(`${method} failed with HTTP ${response.status}`);
    }
    await sleep(500 * 2 ** attempt);
  }

  throw new Error(`${method} failed`);
}

export async function fetchEthUsd() {
  const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
  if (!response.ok) throw new Error(`CoinGecko failed with HTTP ${response.status}`);
  const payload = await response.json();
  return payload.ethereum.usd;
}

export async function fetchBaseFeeSnapshot({ rpcUrl = BASE_RPC_URL } = {}) {
  const [gasPriceHex, feeHistory] = await Promise.all([
    rpcCall(rpcUrl, "eth_gasPrice"),
    rpcCall(rpcUrl, "eth_feeHistory", ["0x64", "latest", [10, 50, 90]]),
  ]);

  const latestBaseFeeHex = feeHistory.baseFeePerGas.at(-1);
  const latestRewards = feeHistory.reward.at(-1) ?? [];

  return {
    gasPriceWei: BigInt(gasPriceHex),
    baseFeeWei: BigInt(latestBaseFeeHex),
    priorityFeeP50Wei: latestRewards[1] ? BigInt(latestRewards[1]) : 1_000_000n,
  };
}

export async function sampleRecentTokenTransfers({
  rpcUrl = BASE_RPC_URL,
  tokenAddress = BASE_USDC_ADDRESS,
  limit = 20,
  maxBlocks = 250,
} = {}) {
  const token = tokenAddress.toLowerCase();
  const latest = BigInt(await rpcCall(rpcUrl, "eth_blockNumber"));
  const samples = [];

  for (let offset = 0n; offset < BigInt(maxBlocks) && samples.length < limit; offset += 1n) {
    const blockNumber = `0x${(latest - offset).toString(16)}`;
    const block = await rpcCall(rpcUrl, "eth_getBlockByNumber", [blockNumber, true]);

    for (const tx of block.transactions) {
      if (tx.to?.toLowerCase() !== token || !tx.input?.startsWith(TRANSFER_SELECTOR)) continue;
      const receipt = await rpcCall(rpcUrl, "eth_getTransactionReceipt", [tx.hash]);
      samples.push({
        blockNumber: Number(BigInt(block.number)),
        hash: tx.hash,
        gasUsed: Number(BigInt(receipt.gasUsed)),
        effectiveGasPriceWei: BigInt(receipt.effectiveGasPrice),
        l1FeeWei: receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n,
      });
      if (samples.length >= limit) break;
    }
  }

  return samples;
}

export function summarizeTransferSamples(samples, ethUsd) {
  if (samples.length === 0) return null;
  const costs = samples.map((sample) => transferCostUsd({
    gasUsed: BigInt(sample.gasUsed),
    gasPriceWei: sample.effectiveGasPriceWei,
    l1FeeWei: sample.l1FeeWei,
    ethUsd,
  })).sort((a, b) => a - b);
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    count: samples.length,
    averageGasUsed: average(samples.map((sample) => sample.gasUsed)),
    averageEffectiveGasPriceGwei: average(samples.map((sample) => Number(sample.effectiveGasPriceWei) / 1e9)),
    averageL1FeeWei: average(samples.map((sample) => Number(sample.l1FeeWei))),
    averageUsdPerTransfer: average(costs),
    medianUsdPerTransfer: costs[Math.floor(costs.length / 2)],
    minUsdPerTransfer: costs[0],
    maxUsdPerTransfer: costs.at(-1),
  };
}

export function conservativeDailyBaseline({
  gasPriceWei,
  ethUsd,
  transfersPerDay = DEFAULT_TRANSFERS_PER_DAY,
  gasUsed = DEFAULT_ERC20_TRANSFER_GAS,
  l1FeeWei = 0n,
}) {
  const usdPerTransfer = transferCostUsd({ gasUsed, gasPriceWei, l1FeeWei, ethUsd });
  return {
    usdPerTransfer,
    usdPerDay: volumeCostUsd({ transfersPerDay, gasUsed, gasPriceWei, l1FeeWei, ethUsd }),
    usdPer30Days: volumeCostUsd({ transfersPerDay, gasUsed, gasPriceWei, l1FeeWei, ethUsd, days: 30 }),
  };
}
