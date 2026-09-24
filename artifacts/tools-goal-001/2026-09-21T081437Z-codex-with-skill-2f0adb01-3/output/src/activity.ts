import { formatEther, formatUnits } from "viem";
import { normalizeAddress, type HexAddress } from "./config.js";

type BlockscoutAddressRef = {
  hash?: string;
  ens_domain_name?: string | null;
};

type BlockscoutTransaction = {
  hash: string;
  timestamp?: string;
  block_number?: number;
  from?: BlockscoutAddressRef;
  to?: BlockscoutAddressRef | null;
  value?: string;
  fee?: { value?: string } | string;
  method?: string | null;
  decoded_input?: { method_call?: string | null } | null;
  result?: string;
};

type BlockscoutTokenTransfer = {
  transaction_hash?: string;
  timestamp?: string;
  block_number?: number;
  from?: BlockscoutAddressRef;
  to?: BlockscoutAddressRef;
  total?: {
    value?: string;
    decimals?: string | number | null;
  } | null;
  token?: {
    symbol?: string | null;
    name?: string | null;
    type?: string | null;
  } | null;
};

type BlockscoutList<T> = {
  items?: T[];
};

export type ActivitySummary = {
  wallet: HexAddress;
  source: string;
  generatedAt: string;
  transactionsAnalyzed: number;
  tokenTransfersAnalyzed: number;
  summary: string;
  recentActivity: string[];
  warnings?: string[];
};

export async function summarizeWalletActivity(options: {
  wallet: string;
  blockscoutBaseUrl: string;
  blockscoutApiKey?: string;
  limit?: number;
}): Promise<ActivitySummary> {
  const wallet = normalizeAddress(options.wallet, "wallet");
  const limit = options.limit ?? 8;
  const baseUrl = options.blockscoutBaseUrl.replace(/\/+$/, "");

  const [transactionResult, transferResult] = await Promise.allSettled([
    fetchBlockscoutList<BlockscoutTransaction>(
      `${baseUrl}/addresses/${wallet}/transactions`,
      options.blockscoutApiKey,
    ),
    fetchBlockscoutList<BlockscoutTokenTransfer>(
      `${baseUrl}/addresses/${wallet}/token-transfers`,
      options.blockscoutApiKey,
    ),
  ]);
  const warnings: string[] = [];
  const transactions = unwrapExplorerResult(transactionResult, "transactions", warnings);
  const tokenTransfers = unwrapExplorerResult(transferResult, "token transfers", warnings);

  if (transactions.length === 0 && tokenTransfers.length === 0 && warnings.length > 0) {
    throw new Error(`Could not fetch wallet activity: ${warnings.join("; ")}`);
  }

  const recentNative = transactions.slice(0, limit).map(tx => describeTransaction(wallet, tx));
  const recentTokens = tokenTransfers.slice(0, limit).map(transfer =>
    describeTokenTransfer(wallet, transfer),
  );
  const recentActivity = [...recentNative, ...recentTokens]
    .filter(Boolean)
    .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))
    .slice(0, limit)
    .map(item => item.text);

  return {
    wallet,
    source: baseUrl,
    generatedAt: new Date().toISOString(),
    transactionsAnalyzed: transactions.length,
    tokenTransfersAnalyzed: tokenTransfers.length,
    summary: buildNarrative(wallet, transactions, tokenTransfers),
    recentActivity,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

async function fetchBlockscoutList<T>(url: string, apiKey?: string): Promise<T[]> {
  const endpoint = new URL(url);
  if (apiKey) {
    endpoint.searchParams.set("apikey", apiKey);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Blockscout returned ${response.status}: ${body.slice(0, 180)}`);
    }

    const json = (await response.json()) as BlockscoutList<T>;
    return Array.isArray(json.items) ? json.items : [];
  } finally {
    clearTimeout(timeout);
  }
}

function unwrapExplorerResult<T>(
  result: PromiseSettledResult<T[]>,
  label: string,
  warnings: string[],
): T[] {
  if (result.status === "fulfilled") {
    return result.value;
  }

  const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
  warnings.push(`Could not fetch ${label}: ${message}`);
  return [];
}

function buildNarrative(
  wallet: HexAddress,
  transactions: BlockscoutTransaction[],
  transfers: BlockscoutTokenTransfer[],
): string {
  if (transactions.length === 0 && transfers.length === 0) {
    return "No recent Base activity was found for this wallet.";
  }

  const sent = transfers.filter(t => sameAddress(t.from?.hash, wallet)).length;
  const received = transfers.filter(t => sameAddress(t.to?.hash, wallet)).length;
  const contractCalls = transactions.filter(tx => {
    const method = tx.method ?? tx.decoded_input?.method_call;
    return Boolean(method && method !== "transfer");
  }).length;
  const failed = transactions.filter(tx => tx.result && tx.result !== "success").length;

  const parts = [
    `${short(wallet)} has ${transactions.length} recent Base transaction(s)`,
    `${transfers.length} token transfer(s)`,
  ];
  if (contractCalls > 0) parts.push(`${contractCalls} contract interaction(s)`);
  if (sent || received) parts.push(`${sent} outbound and ${received} inbound token movement(s)`);
  if (failed > 0) parts.push(`${failed} failed/reverted transaction(s)`);

  return `${parts.join(", ")}.`;
}

function describeTransaction(wallet: HexAddress, tx: BlockscoutTransaction) {
  const method = tx.method ?? tx.decoded_input?.method_call;
  const from = tx.from?.hash;
  const to = tx.to?.hash;
  const value = safeFormatEther(tx.value);
  const direction = sameAddress(from, wallet) ? "sent" : sameAddress(to, wallet) ? "received" : "touched";
  const counterparty = sameAddress(from, wallet) ? to : from;
  const action = method ? `called ${method}` : `${direction} ${value} ETH`;
  const result = tx.result && tx.result !== "success" ? ` (${tx.result})` : "";

  return {
    sortKey: sortKey(tx.timestamp, tx.block_number),
    text: `${dateLabel(tx.timestamp)} ${action}${counterparty ? ` with ${short(counterparty)}` : ""}${result}. Tx ${short(tx.hash)}.`,
  };
}

function describeTokenTransfer(wallet: HexAddress, transfer: BlockscoutTokenTransfer) {
  const direction = sameAddress(transfer.from?.hash, wallet) ? "sent" : "received";
  const counterparty = direction === "sent" ? transfer.to?.hash : transfer.from?.hash;
  const symbol = transfer.token?.symbol ?? transfer.token?.name ?? transfer.token?.type ?? "token";
  const amount = formatTokenAmount(transfer.total?.value, transfer.total?.decimals);

  return {
    sortKey: sortKey(transfer.timestamp, transfer.block_number),
    text: `${dateLabel(transfer.timestamp)} ${direction} ${amount} ${symbol}${counterparty ? ` ${direction === "sent" ? "to" : "from"} ${short(counterparty)}` : ""}.`,
  };
}

function safeFormatEther(value?: string): string {
  if (!value) return "0";
  try {
    return trimDecimals(formatEther(BigInt(value)), 6);
  } catch {
    return "0";
  }
}

function formatTokenAmount(value?: string, decimals?: string | number | null): string {
  if (!value) return "1";
  const parsedDecimals = Number(decimals ?? 0);
  if (!Number.isInteger(parsedDecimals) || parsedDecimals < 0) return value;

  try {
    return trimDecimals(formatUnits(BigInt(value), parsedDecimals), 6);
  } catch {
    return value;
  }
}

function trimDecimals(value: string, maxDecimals: number): string {
  const [whole, fraction] = value.split(".");
  if (!fraction) return whole;
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function sameAddress(a: string | undefined | null, b: string): boolean {
  return Boolean(a && a.toLowerCase() === b.toLowerCase());
}

function short(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function sortKey(timestamp?: string, blockNumber?: number): number {
  return timestamp ? Date.parse(timestamp) : blockNumber ?? 0;
}

function dateLabel(timestamp?: string): string {
  if (!timestamp) return "Recently";
  return new Date(timestamp).toISOString().slice(0, 10);
}
