const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export function asBigInt(hexValue) {
  if (hexValue == null) return 0n;
  return BigInt(hexValue);
}

export function formatEth(wei, decimals = 9) {
  const negative = wei < 0n;
  const value = negative ? -wei : wei;
  const whole = value / 10n ** 18n;
  const fraction = value % 10n ** 18n;
  const padded = fraction.toString().padStart(18, "0").slice(0, decimals);
  return `${negative ? "-" : ""}${whole}.${padded}`;
}

export function formatGwei(wei, decimals = 6) {
  const value = BigInt(wei);
  const whole = value / 10n ** 9n;
  const fraction = value % 10n ** 9n;
  return `${whole}.${fraction.toString().padStart(9, "0").slice(0, decimals)}`;
}

export function formatUsd(wei, ethUsd) {
  if (!Number.isFinite(ethUsd)) return null;
  return Number(formatEth(wei, 18)) * ethUsd;
}

export function normalizeAddress(address) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) {
    throw new Error(`Invalid address: ${address}`);
  }
  return address.toLowerCase();
}

export function addressTopic(address) {
  return `0x${normalizeAddress(address).slice(2).padStart(64, "0")}`;
}

export function toHex(value) {
  return `0x${BigInt(value).toString(16)}`;
}

export async function rpc(url, method, params = []) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(`RPC ${method} failed with HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(`RPC ${method} failed: ${payload.error.message || JSON.stringify(payload.error)}`);
  }
  return payload.result;
}

export async function latestBlock(url) {
  return asBigInt(await rpc(url, "eth_blockNumber"));
}

export function receiptCost(receipt) {
  const executionWei = asBigInt(receipt.gasUsed) * asBigInt(receipt.effectiveGasPrice);
  const l1DataWei = asBigInt(receipt.l1Fee);
  return {
    executionWei,
    l1DataWei,
    totalWei: executionWei + l1DataWei,
  };
}

export async function getLogsChunked(url, filter, fromBlock, toBlock, span) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += span + 1n) {
    const end = start + span > toBlock ? toBlock : start + span;
    const chunkFilter = {
      ...filter,
      fromBlock: toHex(start),
      toBlock: toHex(end),
    };
    logs.push(...(await rpc(url, "eth_getLogs", [chunkFilter])));
  }
  return logs;
}

export async function relayerTransferTxHashes({ url, relayer, fromBlock, toBlock, tokens = [], chunkSpan = 2_000n }) {
  const filter = {
    topics: [TRANSFER_TOPIC, addressTopic(relayer)],
  };
  if (tokens.length > 0) {
    filter.address = tokens.map(normalizeAddress);
  }

  const logs = await getLogsChunked(url, filter, BigInt(fromBlock), BigInt(toBlock), BigInt(chunkSpan));
  return [...new Set(logs.map((log) => log.transactionHash))];
}

export async function summarizeRelayerGas({ url, relayer, fromBlock, toBlock, tokens = [], chunkSpan = 2_000n }) {
  const normalizedRelayer = normalizeAddress(relayer);
  const hashes = await relayerTransferTxHashes({ url, relayer, fromBlock, toBlock, tokens, chunkSpan });
  const summary = {
    relayer: normalizedRelayer,
    fromBlock: Number(fromBlock),
    toBlock: Number(toBlock),
    transferEventTxs: hashes.length,
    relayerTxs: 0,
    gasUsed: 0n,
    executionWei: 0n,
    l1DataWei: 0n,
    totalWei: 0n,
    missingL1FeeReceipts: 0,
  };

  for (const hash of hashes) {
    const receipt = await rpc(url, "eth_getTransactionReceipt", [hash]);
    if (normalizeAddress(receipt.from) !== normalizedRelayer) continue;

    const cost = receiptCost(receipt);
    summary.relayerTxs += 1;
    summary.gasUsed += asBigInt(receipt.gasUsed);
    summary.executionWei += cost.executionWei;
    summary.l1DataWei += cost.l1DataWei;
    summary.totalWei += cost.totalWei;
    if (receipt.l1Fee == null) summary.missingL1FeeReceipts += 1;
  }

  return summary;
}

export async function feeHistorySummary(url, blocks = 100, percentiles = [10, 50, 90]) {
  const history = await rpc(url, "eth_feeHistory", [toHex(blocks), "latest", percentiles]);
  const baseFees = history.baseFeePerGas.map(asBigInt);
  const rewards = history.reward.flat().map(asBigInt);
  return {
    latestBaseFeeWei: baseFees.at(-1),
    medianPriorityFeeWei: percentile(rewards, 50),
    p90PriorityFeeWei: percentile(rewards, 90),
  };
}

export async function suggestBaseFeeCaps(url, { blocks = 100, baseFeeMultiplier = 2n, minPriorityFeeWei = 1_000_000n } = {}) {
  const history = await feeHistorySummary(url, blocks);
  const priorityFeeWei =
    history.medianPriorityFeeWei > minPriorityFeeWei ? history.medianPriorityFeeWei : minPriorityFeeWei;
  return {
    maxPriorityFeePerGas: priorityFeeWei,
    maxFeePerGas: history.latestBaseFeeWei * baseFeeMultiplier + priorityFeeWei,
    latestBaseFeeWei: history.latestBaseFeeWei,
    p90PriorityFeeWei: history.p90PriorityFeeWei,
  };
}

export function percentile(values, pct) {
  if (values.length === 0) return 0n;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const index = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
  return sorted[index];
}

export function jsonWithBigInts(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}
