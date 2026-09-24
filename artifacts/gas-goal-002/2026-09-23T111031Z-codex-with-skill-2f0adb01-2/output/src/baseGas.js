const BASE_RPC_URL = "https://mainnet.base.org";
const GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F";
const ERC20_TRANSFER_SELECTOR = "a9059cbb";

const DEFAULT_TRANSFERS_PER_DAY = 40_000;
const DEFAULT_OBSERVED_ERC20_TRANSFER_GAS = 45_576;
const DEFAULT_DAYS_PER_MONTH = 30;
const DEFAULT_DAYS_PER_YEAR = 365;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function strip0x(value) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function hexToBigInt(value) {
  if (!value || value === "0x") return 0n;
  return BigInt(value);
}

function weiToEth(wei) {
  return Number(wei) / 1e18;
}

function weiToUsd(wei, ethUsd) {
  return weiToEth(wei) * ethUsd;
}

function gweiToWei(gwei) {
  return BigInt(Math.round(Number(gwei) * 1e9));
}

function weiToGwei(wei) {
  return Number(wei) / 1e9;
}

async function rpcCall(rpcUrl, method, params = [], options = {}) {
  const retries = options.retries ?? 4;
  const backoffMs = options.backoffMs ?? 350;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const body = await response.json();

    if (!body.error) return body.result;

    const isRetryable =
      response.status === 429 ||
      body.error.code === -32016 ||
      /rate|limit|timeout/i.test(body.error.message || "");
    if (!isRetryable || attempt === retries) {
      throw new Error(`${method} failed: ${JSON.stringify(body.error)}`);
    }
    await sleep(backoffMs * 2 ** attempt);
  }

  throw new Error(`${method} failed`);
}

function pad32(hex) {
  const clean = strip0x(hex);
  if (clean.length > 64) throw new Error(`value exceeds 32 bytes: ${hex}`);
  return clean.padStart(64, "0");
}

function encodeBytesForAbi(hexBytes) {
  const clean = strip0x(hexBytes);
  const byteLength = clean.length / 2;
  const paddedLength = Math.ceil(byteLength / 32) * 64;
  return `${pad32("20")}${pad32(byteLength.toString(16))}${clean.padEnd(paddedLength, "0")}`;
}

function erc20TransferCalldata(to, amount) {
  const address = strip0x(to).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(address)) {
    throw new Error(`invalid recipient address: ${to}`);
  }
  const amountHex = BigInt(amount).toString(16);
  return `0x${ERC20_TRANSFER_SELECTOR}${pad32(address)}${pad32(amountHex)}`;
}

function gasOracleGetL1FeeCallData(transactionData) {
  const selector = "49948e0e"; // getL1Fee(bytes)
  return `0x${selector}${encodeBytesForAbi(transactionData)}`;
}

async function fetchEthUsd() {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`ETH/USD fetch failed: ${response.status}`);
  const body = await response.json();
  const price = body?.ethereum?.usd;
  if (!Number.isFinite(price)) throw new Error("ETH/USD response did not include ethereum.usd");
  return price;
}

async function getBaseFeeSnapshot(rpcUrl = BASE_RPC_URL) {
  const [block, gasPriceHex, feeHistory] = await Promise.all([
    rpcCall(rpcUrl, "eth_getBlockByNumber", ["latest", false]),
    rpcCall(rpcUrl, "eth_gasPrice", []),
    rpcCall(rpcUrl, "eth_feeHistory", ["0x64", "latest", [10, 50, 90]]),
  ]);

  const baseFeeWei = hexToBigInt(block.baseFeePerGas);
  const gasPriceWei = hexToBigInt(gasPriceHex);
  const priorityFeeWei = gasPriceWei > baseFeeWei ? gasPriceWei - baseFeeWei : 0n;
  const rewards = (feeHistory.reward || []).flat().map(hexToBigInt);
  rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    blockNumber: Number(hexToBigInt(block.number)),
    baseFeeWei,
    gasPriceWei,
    priorityFeeWei,
    rewardP50Wei: percentileBigInt(rewards, 0.5),
    rewardP90Wei: percentileBigInt(rewards, 0.9),
  };
}

async function estimateL1FeeForTransfer(rpcUrl = BASE_RPC_URL, options = {}) {
  const to = options.to || "0x1111111111111111111111111111111111111111";
  const amount = options.amount ?? 1n;
  const data = erc20TransferCalldata(to, amount);
  const result = await rpcCall(rpcUrl, "eth_call", [
    {
      to: GAS_PRICE_ORACLE,
      data: gasOracleGetL1FeeCallData(data),
    },
    "latest",
  ]);
  return hexToBigInt(result);
}

function estimateTransferSpend(options) {
  const {
    transfersPerDay = DEFAULT_TRANSFERS_PER_DAY,
    daysPerMonth = DEFAULT_DAYS_PER_MONTH,
    daysPerYear = DEFAULT_DAYS_PER_YEAR,
    executionGas = DEFAULT_OBSERVED_ERC20_TRANSFER_GAS,
    effectiveGasPriceWei,
    l1FeeWei = 0n,
    ethUsd,
  } = options;

  if (effectiveGasPriceWei == null) throw new Error("effectiveGasPriceWei is required");
  if (!Number.isFinite(ethUsd)) throw new Error("ethUsd is required");

  const executionFeeWei = BigInt(Math.round(executionGas)) * BigInt(effectiveGasPriceWei);
  const perTransferWei = executionFeeWei + BigInt(l1FeeWei);
  const perTransferUsd = weiToUsd(perTransferWei, ethUsd);
  const dailyUsd = perTransferUsd * transfersPerDay;
  const monthlyUsd = dailyUsd * daysPerMonth;
  const yearlyUsd = dailyUsd * daysPerYear;

  return {
    executionFeeWei,
    l1FeeWei: BigInt(l1FeeWei),
    perTransferWei,
    perTransferEth: weiToEth(perTransferWei),
    perTransferUsd,
    dailyUsd,
    monthlyUsd,
    yearlyUsd,
  };
}

function estimateFromObservedAverage(samples, options) {
  if (!samples.length) throw new Error("at least one sample is required");
  const totalEth = samples.reduce((sum, sample) => sum + sample.totalEth, 0) / samples.length;
  const perTransferUsd = totalEth * options.ethUsd;
  const dailyUsd = perTransferUsd * options.transfersPerDay;
  return {
    perTransferEth: totalEth,
    perTransferUsd,
    dailyUsd,
    monthlyUsd: dailyUsd * (options.daysPerMonth ?? DEFAULT_DAYS_PER_MONTH),
    yearlyUsd: dailyUsd * (options.daysPerYear ?? DEFAULT_DAYS_PER_YEAR),
  };
}

async function sampleRecentErc20Transfers(rpcUrl = BASE_RPC_URL, options = {}) {
  const targetSamples = options.targetSamples ?? 25;
  const maxBlocks = options.maxBlocks ?? 160;
  const latestHex = await rpcCall(rpcUrl, "eth_blockNumber", []);
  const latest = Number(hexToBigInt(latestHex));
  const samples = [];

  for (let blockNumber = latest; blockNumber > latest - maxBlocks && samples.length < targetSamples; blockNumber -= 1) {
    const block = await rpcCall(rpcUrl, "eth_getBlockByNumber", [`0x${blockNumber.toString(16)}`, true]);
    for (const tx of block.transactions || []) {
      const input = tx.input || tx.data || "";
      if (!input.startsWith(`0x${ERC20_TRANSFER_SELECTOR}`) || !tx.to) continue;

      const receipt = await rpcCall(rpcUrl, "eth_getTransactionReceipt", [tx.hash], {
        retries: options.retries ?? 6,
        backoffMs: options.backoffMs ?? 500,
      });
      if (receipt.status !== "0x1") continue;

      const gasUsed = Number(hexToBigInt(receipt.gasUsed));
      const effectiveGasPriceWei = hexToBigInt(receipt.effectiveGasPrice);
      const executionFeeWei = BigInt(gasUsed) * effectiveGasPriceWei;
      const l1FeeWei = hexToBigInt(receipt.l1Fee);
      const totalWei = executionFeeWei + l1FeeWei;

      samples.push({
        hash: tx.hash,
        blockNumber,
        token: tx.to,
        gasUsed,
        effectiveGasPriceGwei: weiToGwei(effectiveGasPriceWei),
        executionFeeEth: weiToEth(executionFeeWei),
        l1FeeEth: weiToEth(l1FeeWei),
        totalEth: weiToEth(totalWei),
        calldataBytes: (input.length - 2) / 2,
      });

      if (samples.length >= targetSamples) break;
    }
  }

  return samples;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function percentileBigInt(sortedValues, p) {
  if (!sortedValues.length) return 0n;
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * p))];
}

function summarizeSamples(samples) {
  if (!samples.length) {
    return { count: 0 };
  }

  const average = (key) => samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
  return {
    count: samples.length,
    average: {
      gasUsed: average("gasUsed"),
      effectiveGasPriceGwei: average("effectiveGasPriceGwei"),
      executionFeeEth: average("executionFeeEth"),
      l1FeeEth: average("l1FeeEth"),
      totalEth: average("totalEth"),
      calldataBytes: average("calldataBytes"),
    },
    p50: {
      gasUsed: percentile(samples.map((sample) => sample.gasUsed), 0.5),
      totalEth: percentile(samples.map((sample) => sample.totalEth), 0.5),
    },
    p90: {
      gasUsed: percentile(samples.map((sample) => sample.gasUsed), 0.9),
      totalEth: percentile(samples.map((sample) => sample.totalEth), 0.9),
    },
  };
}

function buildBaseRelayerFeePolicy(snapshot, options = {}) {
  const priorityFloorWei = gweiToWei(options.priorityFloorGwei ?? 0.001);
  const priorityCeilingWei = gweiToWei(options.priorityCeilingGwei ?? 0.02);
  const observedPriorityWei = snapshot.rewardP50Wei || snapshot.priorityFeeWei || priorityFloorWei;
  const maxPriorityFeePerGas =
    observedPriorityWei < priorityFloorWei
      ? priorityFloorWei
      : observedPriorityWei > priorityCeilingWei
        ? priorityCeilingWei
        : observedPriorityWei;
  const baseFeeMultiplier = BigInt(options.baseFeeMultiplier ?? 3);
  const maxFeePerGas = snapshot.baseFeeWei * baseFeeMultiplier + maxPriorityFeePerGas;
  const deferAboveBaseFeeWei = gweiToWei(options.deferAboveBaseFeeGwei ?? 0.05);

  return {
    maxFeePerGas,
    maxPriorityFeePerGas,
    maxFeePerGasGwei: weiToGwei(maxFeePerGas),
    maxPriorityFeePerGasGwei: weiToGwei(maxPriorityFeePerGas),
    shouldDeferNonUrgent: snapshot.baseFeeWei > deferAboveBaseFeeWei,
    observedBaseFeeGwei: weiToGwei(snapshot.baseFeeWei),
    observedGasPriceGwei: weiToGwei(snapshot.gasPriceWei),
  };
}

function savingsForReduction(baselineMonthlyUsd, reductionFraction) {
  return {
    reductionFraction,
    monthlyUsd: baselineMonthlyUsd * reductionFraction,
    yearlyUsd: baselineMonthlyUsd * reductionFraction * 12,
  };
}

module.exports = {
  BASE_RPC_URL,
  DEFAULT_OBSERVED_ERC20_TRANSFER_GAS,
  DEFAULT_TRANSFERS_PER_DAY,
  erc20TransferCalldata,
  estimateFromObservedAverage,
  estimateL1FeeForTransfer,
  estimateTransferSpend,
  fetchEthUsd,
  getBaseFeeSnapshot,
  buildBaseRelayerFeePolicy,
  sampleRecentErc20Transfers,
  savingsForReduction,
  summarizeSamples,
  weiToEth,
  weiToGwei,
  weiToUsd,
  gweiToWei,
};
