import { formatEther, formatUnits, getAddress, isAddress } from "viem";

type BlockscoutAddress = {
  hash?: string;
  name?: string | null;
  ens_domain_name?: string | null;
  is_contract?: boolean;
};

type BlockscoutTransaction = {
  hash: string;
  from?: BlockscoutAddress | null;
  to?: BlockscoutAddress | null;
  value?: string | null;
  fee?: { value?: string | null } | string | null;
  method?: string | null;
  result?: string | null;
  status?: string | null;
  timestamp?: string | null;
  transaction_types?: string[] | null;
};

type BlockscoutTokenTransfer = {
  from?: BlockscoutAddress | null;
  to?: BlockscoutAddress | null;
  token?: {
    symbol?: string | null;
    name?: string | null;
    decimals?: string | null;
    type?: string | null;
  } | null;
  total?: {
    value?: string | null;
    decimals?: string | null;
  } | null;
  token_type?: string | null;
  timestamp?: string | null;
  transaction_hash?: string | null;
};

type PaginatedResponse<T> = {
  items?: T[];
};

export type WalletActivitySummary = {
  wallet: string;
  network: "Base";
  source: string;
  generatedAt: string;
  window: {
    firstSeen: string | null;
    lastSeen: string | null;
    sampledTransactions: number;
    sampledTokenTransfers: number;
  };
  counters: {
    successfulTransactions: number;
    failedTransactions: number;
    outgoingTransactions: number;
    incomingTransactions: number;
    contractInteractions: number;
    uniqueCounterparties: number;
  };
  highlights: string[];
  recentTransactions: Array<{
    hash: string;
    when: string | null;
    direction: "in" | "out" | "self" | "unknown";
    method: string;
    counterparty: string | null;
    valueEth: string;
    result: string;
  }>;
  summary: string;
};

const DEFAULT_BLOCKSCOUT_API = "https://base.blockscout.com/api/v2";

export async function getWalletActivitySummary(
  rawAddress: string,
  blockscoutApi = process.env.BASE_BLOCKSCOUT_API ?? DEFAULT_BLOCKSCOUT_API,
): Promise<WalletActivitySummary> {
  if (!isAddress(rawAddress)) {
    throw new Error("address must be a valid EVM address");
  }

  const wallet = getAddress(rawAddress);
  const [transactions, tokenTransfers] = await Promise.all([
    fetchBlockscout<PaginatedResponse<BlockscoutTransaction>>(
      `${blockscoutApi}/addresses/${wallet}/transactions`,
    ),
    fetchBlockscout<PaginatedResponse<BlockscoutTokenTransfer>>(
      `${blockscoutApi}/addresses/${wallet}/token-transfers`,
    ),
  ]);

  const txs = transactions.items?.slice(0, 10) ?? [];
  const transfers = tokenTransfers.items?.slice(0, 20) ?? [];
  const walletLower = wallet.toLowerCase();

  const directions = txs.map((tx) => getTransactionDirection(tx, walletLower));
  const successfulTransactions = txs.filter((tx) => getResult(tx) === "success").length;
  const failedTransactions = txs.filter((tx) => getResult(tx) !== "success").length;
  const outgoingTransactions = directions.filter((direction) => direction === "out").length;
  const incomingTransactions = directions.filter((direction) => direction === "in").length;
  const contractInteractions = txs.filter(
    (tx) => tx.to?.is_contract || (tx.method && tx.method !== "transfer"),
  ).length;

  const counterparties = new Set(
    txs
      .map((tx) => getCounterparty(tx, walletLower))
      .filter((counterparty): counterparty is string => Boolean(counterparty)),
  );

  const firstSeen = [...txs].reverse().find((tx) => tx.timestamp)?.timestamp ?? null;
  const lastSeen = txs.find((tx) => tx.timestamp)?.timestamp ?? null;
  const topMethods = topCounts(txs.map((tx) => normalizeMethod(tx.method)));
  const topTokens = topCounts(
    transfers
      .map((transfer) => transfer.token?.symbol ?? transfer.token?.name ?? transfer.token_type)
      .filter((symbol): symbol is string => Boolean(symbol)),
  );

  const totalEthOut = txs
    .filter((tx) => getTransactionDirection(tx, walletLower) === "out")
    .reduce((sum, tx) => sum + BigInt(tx.value ?? "0"), 0n);
  const totalEthIn = txs
    .filter((tx) => getTransactionDirection(tx, walletLower) === "in")
    .reduce((sum, tx) => sum + BigInt(tx.value ?? "0"), 0n);

  const highlights = [
    `${successfulTransactions}/${txs.length} sampled transactions succeeded`,
    `${outgoingTransactions} outgoing, ${incomingTransactions} incoming, ${contractInteractions} contract interactions`,
    topMethods.length > 0
      ? `Most common methods: ${topMethods.map(([method, count]) => `${method} (${count})`).join(", ")}`
      : "No decoded method names in the sampled transactions",
    topTokens.length > 0
      ? `Recent token activity: ${topTokens.map(([token, count]) => `${token} (${count})`).join(", ")}`
      : "No token transfers in the sampled window",
  ];

  const recentTransactions = txs.slice(0, 5).map((tx) => {
    const direction = getTransactionDirection(tx, walletLower);
    return {
      hash: tx.hash,
      when: tx.timestamp ?? null,
      direction,
      method: normalizeMethod(tx.method),
      counterparty: getCounterparty(tx, walletLower),
      valueEth: formatDecimal(formatEther(BigInt(tx.value ?? "0"))),
      result: getResult(tx),
    };
  });

  return {
    wallet,
    network: "Base",
    source: blockscoutApi,
    generatedAt: new Date().toISOString(),
    window: {
      firstSeen,
      lastSeen,
      sampledTransactions: txs.length,
      sampledTokenTransfers: transfers.length,
    },
    counters: {
      successfulTransactions,
      failedTransactions,
      outgoingTransactions,
      incomingTransactions,
      contractInteractions,
      uniqueCounterparties: counterparties.size,
    },
    highlights,
    recentTransactions,
    summary: [
      `${shortAddress(wallet)} has ${txs.length} recent Base transactions in the sample.`,
      `The activity is ${outgoingTransactions >= incomingTransactions ? "mostly outgoing or contract-call driven" : "mostly inbound"}.`,
      `Sampled native movement totals ${formatDecimal(formatEther(totalEthOut))} ETH out and ${formatDecimal(formatEther(totalEthIn))} ETH in.`,
      topTokens[0] ? `Token activity is led by ${topTokens[0][0]}.` : "No recent token-transfer activity was found.",
    ].join(" "),
  };
}

async function fetchBlockscout<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Blockscout request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

function getTransactionDirection(
  tx: BlockscoutTransaction,
  walletLower: string,
): "in" | "out" | "self" | "unknown" {
  const from = tx.from?.hash?.toLowerCase();
  const to = tx.to?.hash?.toLowerCase();

  if (from === walletLower && to === walletLower) return "self";
  if (from === walletLower) return "out";
  if (to === walletLower) return "in";
  return "unknown";
}

function getCounterparty(tx: BlockscoutTransaction, walletLower: string): string | null {
  const direction = getTransactionDirection(tx, walletLower);
  if (direction === "out") return tx.to?.hash ?? null;
  if (direction === "in") return tx.from?.hash ?? null;
  return null;
}

function getResult(tx: BlockscoutTransaction): string {
  return tx.result ?? tx.status ?? "unknown";
}

function normalizeMethod(method: string | null | undefined): string {
  if (!method || method === "0x") return "transfer";
  return method;
}

function topCounts(values: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
}

function formatDecimal(value: string): string {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return value;
  if (numberValue === 0) return "0";
  if (numberValue < 0.000001) return "<0.000001";
  return numberValue.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(value: string, decimals = "0"): string {
  return formatDecimal(formatUnits(BigInt(value), Number(decimals)));
}
