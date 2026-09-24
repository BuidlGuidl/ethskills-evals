import { formatEther, formatUnits, getAddress, isAddress, type Address } from "viem";
import { env } from "./config.js";

type BlockscoutAddress = {
  hash?: string;
  name?: string | null;
  is_contract?: boolean;
};

type BlockscoutTransaction = {
  hash: string;
  timestamp?: string;
  from?: BlockscoutAddress | null;
  to?: BlockscoutAddress | null;
  value?: string;
  status?: string | null;
  result?: string | null;
  method?: string | null;
  transaction_types?: string[];
};

type BlockscoutTokenTransfer = {
  timestamp?: string;
  transaction_hash: string;
  from?: BlockscoutAddress | null;
  to?: BlockscoutAddress | null;
  token?: {
    symbol?: string | null;
    name?: string | null;
    decimals?: string | null;
  } | null;
  total?: {
    value?: string | null;
    decimals?: string | null;
  } | null;
  token_type?: string | null;
};

type BlockscoutList<T> = {
  items?: T[];
};

export type WalletActivitySummary = {
  address: Address;
  network: "base";
  generatedAt: string;
  summary: string;
  window: {
    transactionsChecked: number;
    tokenTransfersChecked: number;
    newestTimestamp: string | null;
    oldestTimestamp: string | null;
  };
  highlights: {
    incomingTransactions: number;
    outgoingTransactions: number;
    failedTransactions: number;
    contractInteractions: number;
    topMethods: Array<{ method: string; count: number }>;
    nativeFlow: {
      incomingEth: string;
      outgoingEth: string;
    };
    tokenFlows: Array<{
      symbol: string;
      incoming: string;
      outgoing: string;
    }>;
    latestTransactions: Array<{
      hash: string;
      timestamp: string | null;
      direction: "in" | "out" | "self" | "unknown";
      method: string;
      valueEth: string;
    }>;
  };
  source: {
    name: "Base Blockscout";
    url: string;
  };
};

export function normalizeWalletAddress(input: unknown): Address {
  if (typeof input !== "string" || !isAddress(input)) {
    throw new Error("Query parameter `address` must be a valid EVM address");
  }

  return getAddress(input);
}

export async function summarizeWalletActivity(address: Address): Promise<WalletActivitySummary> {
  const [transactions, tokenTransfers] = await Promise.all([
    fetchBlockscoutList<BlockscoutTransaction>(`/api/v2/addresses/${address}/transactions`),
    fetchBlockscoutList<BlockscoutTokenTransfer>(`/api/v2/addresses/${address}/token-transfers`),
  ]);

  const recentTransactions = transactions.slice(0, 25);
  const recentTokenTransfers = tokenTransfers.slice(0, 25);
  const lowerAddress = address.toLowerCase();

  let incomingTransactions = 0;
  let outgoingTransactions = 0;
  let failedTransactions = 0;
  let contractInteractions = 0;
  let nativeIn = 0n;
  let nativeOut = 0n;

  const methodCounts = new Map<string, number>();

  for (const tx of recentTransactions) {
    const direction = transactionDirection(tx, lowerAddress);

    if (direction === "in") incomingTransactions += 1;
    if (direction === "out") outgoingTransactions += 1;
    if (isFailed(tx)) failedTransactions += 1;
    if (tx.transaction_types?.includes("contract_call") || tx.method) contractInteractions += 1;

    const value = parseBigInt(tx.value);
    if (direction === "in") nativeIn += value;
    if (direction === "out") nativeOut += value;

    const method = tx.method?.trim() || "transfer";
    methodCounts.set(method, (methodCounts.get(method) ?? 0) + 1);
  }

  const tokenFlows = summarizeTokenFlows(recentTokenTransfers, lowerAddress);
  const timestamps = recentTransactions
    .map(tx => tx.timestamp)
    .filter((timestamp): timestamp is string => Boolean(timestamp));

  const topMethods = [...methodCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([method, count]) => ({ method, count }));

  const latestTransactions = recentTransactions.slice(0, 5).map(tx => ({
    hash: tx.hash,
    timestamp: tx.timestamp ?? null,
    direction: transactionDirection(tx, lowerAddress),
    method: tx.method?.trim() || "transfer",
    valueEth: formatAmount(formatEther(parseBigInt(tx.value))),
  }));

  const summary = buildSummary({
    address,
    transactionCount: recentTransactions.length,
    tokenTransferCount: recentTokenTransfers.length,
    incomingTransactions,
    outgoingTransactions,
    failedTransactions,
    contractInteractions,
    topMethods,
    nativeIn,
    nativeOut,
    tokenFlows,
    newestTimestamp: timestamps[0] ?? null,
    oldestTimestamp: timestamps.at(-1) ?? null,
  });

  return {
    address,
    network: "base",
    generatedAt: new Date().toISOString(),
    summary,
    window: {
      transactionsChecked: recentTransactions.length,
      tokenTransfersChecked: recentTokenTransfers.length,
      newestTimestamp: timestamps[0] ?? null,
      oldestTimestamp: timestamps.at(-1) ?? null,
    },
    highlights: {
      incomingTransactions,
      outgoingTransactions,
      failedTransactions,
      contractInteractions,
      topMethods,
      nativeFlow: {
        incomingEth: formatAmount(formatEther(nativeIn)),
        outgoingEth: formatAmount(formatEther(nativeOut)),
      },
      tokenFlows,
      latestTransactions,
    },
    source: {
      name: "Base Blockscout",
      url: `${env.BLOCKSCOUT_BASE_URL}/address/${address}`,
    },
  };
}

async function fetchBlockscoutList<T>(path: string): Promise<T[]> {
  const url = new URL(path, env.BLOCKSCOUT_BASE_URL);
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "paid-wallet-activity-api/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Blockscout request failed with ${response.status} for ${url.pathname}`);
  }

  const data = (await response.json()) as BlockscoutList<T>;
  return data.items ?? [];
}

function summarizeTokenFlows(transfers: BlockscoutTokenTransfer[], lowerAddress: string) {
  const flows = new Map<
    string,
    {
      decimals: number;
      incoming: bigint;
      outgoing: bigint;
    }
  >();

  for (const transfer of transfers) {
    const direction = transferDirection(transfer, lowerAddress);
    if (direction !== "in" && direction !== "out") continue;

    const symbol = cleanSymbol(transfer.token?.symbol ?? transfer.token?.name ?? transfer.token_type ?? "TOKEN");
    const decimals = Number(transfer.total?.decimals ?? transfer.token?.decimals ?? 0);
    const value = parseBigInt(transfer.total?.value);
    const current = flows.get(symbol) ?? { decimals, incoming: 0n, outgoing: 0n };

    if (direction === "in") current.incoming += value;
    if (direction === "out") current.outgoing += value;

    flows.set(symbol, current);
  }

  return [...flows.entries()]
    .map(([symbol, flow]) => ({
      symbol,
      incoming: formatAmount(formatUnits(flow.incoming, flow.decimals)),
      outgoing: formatAmount(formatUnits(flow.outgoing, flow.decimals)),
    }))
    .filter(flow => flow.incoming !== "0" || flow.outgoing !== "0")
    .slice(0, 8);
}

function buildSummary(input: {
  address: Address;
  transactionCount: number;
  tokenTransferCount: number;
  incomingTransactions: number;
  outgoingTransactions: number;
  failedTransactions: number;
  contractInteractions: number;
  topMethods: Array<{ method: string; count: number }>;
  nativeIn: bigint;
  nativeOut: bigint;
  tokenFlows: Array<{ symbol: string; incoming: string; outgoing: string }>;
  newestTimestamp: string | null;
  oldestTimestamp: string | null;
}) {
  if (input.transactionCount === 0 && input.tokenTransferCount === 0) {
    return `${shortAddress(input.address)} has no recent Base transactions or token transfers indexed by Blockscout.`;
  }

  const methodText = input.topMethods.length
    ? `Common actions: ${input.topMethods.map(item => `${item.method} (${item.count})`).join(", ")}.`
    : "No decoded contract methods stood out.";

  const tokenText = input.tokenFlows.length
    ? `Token movement: ${input.tokenFlows
        .slice(0, 3)
        .map(flow => `${flow.incoming} in / ${flow.outgoing} out ${flow.symbol}`)
        .join("; ")}.`
    : "No recent token-transfer flow was found.";

  const nativeText =
    input.nativeIn > 0n || input.nativeOut > 0n
      ? `Native ETH flow was ${formatAmount(formatEther(input.nativeIn))} in and ${formatAmount(formatEther(input.nativeOut))} out.`
      : "Native ETH value was negligible or zero in these transactions.";

  const sinceText = input.oldestTimestamp ? ` since ${input.oldestTimestamp}` : "";

  return `${shortAddress(input.address)} had ${input.transactionCount} recent Base transactions${sinceText}: ${input.outgoingTransactions} outgoing, ${input.incomingTransactions} incoming, ${input.failedTransactions} failed, and ${input.contractInteractions} contract interactions. ${methodText} ${tokenText} ${nativeText}`;
}

function transactionDirection(
  tx: BlockscoutTransaction,
  lowerAddress: string,
): "in" | "out" | "self" | "unknown" {
  const from = tx.from?.hash?.toLowerCase();
  const to = tx.to?.hash?.toLowerCase();

  if (from === lowerAddress && to === lowerAddress) return "self";
  if (from === lowerAddress) return "out";
  if (to === lowerAddress) return "in";

  return "unknown";
}

function transferDirection(
  transfer: BlockscoutTokenTransfer,
  lowerAddress: string,
): "in" | "out" | "self" | "unknown" {
  const from = transfer.from?.hash?.toLowerCase();
  const to = transfer.to?.hash?.toLowerCase();

  if (from === lowerAddress && to === lowerAddress) return "self";
  if (from === lowerAddress) return "out";
  if (to === lowerAddress) return "in";

  return "unknown";
}

function isFailed(tx: BlockscoutTransaction) {
  return tx.status === "error" || tx.result === "error" || tx.result === "failed";
}

function parseBigInt(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) return 0n;
  return BigInt(value);
}

function cleanSymbol(symbol: string) {
  return symbol.replace(/\s+/g, " ").trim().slice(0, 24) || "TOKEN";
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAmount(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "").slice(0, 6);

  if (!trimmedFraction) return whole;
  return `${whole}.${trimmedFraction}`;
}
