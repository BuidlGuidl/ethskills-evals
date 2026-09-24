import { formatEther, getAddress, isAddress } from "viem";

type BlockscoutAddress = {
  hash?: string;
  name?: string | null;
};

type BlockscoutTransaction = {
  hash?: string;
  timestamp?: string;
  block_number?: number;
  from?: BlockscoutAddress;
  to?: BlockscoutAddress | null;
  method?: string | null;
  value?: string;
  status?: string;
  result?: string;
};

type BlockscoutTransactionsResponse = {
  items?: BlockscoutTransaction[];
};

export type WalletActivitySummary = {
  wallet: string;
  chainExplorer: string;
  inspectedTransactions: number;
  summary: string;
  recentTransactions: Array<{
    hash: string;
    direction: "in" | "out" | "self" | "unknown";
    counterparty?: string;
    method: string;
    valueEth: string;
    status: string;
    timestamp?: string;
    blockNumber?: number;
  }>;
};

export async function summarizeWalletActivity(
  wallet: string,
  blockscoutBaseUrl: string,
): Promise<WalletActivitySummary> {
  if (!isAddress(wallet)) {
    throw new Error("Invalid wallet address");
  }

  const normalizedWallet = getAddress(wallet);
  const url = new URL(`/api/v2/addresses/${normalizedWallet}/transactions`, blockscoutBaseUrl);

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "x402-wallet-summary-demo/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Blockscout returned ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as BlockscoutTransactionsResponse;
  const transactions = (data.items ?? []).slice(0, 10);
  const recentTransactions = transactions.map(tx => normalizeTransaction(tx, normalizedWallet));

  return {
    wallet: normalizedWallet,
    chainExplorer: blockscoutBaseUrl,
    inspectedTransactions: recentTransactions.length,
    summary: buildSummary(recentTransactions),
    recentTransactions,
  };
}

function normalizeTransaction(
  tx: BlockscoutTransaction,
  wallet: string,
): WalletActivitySummary["recentTransactions"][number] {
  const from = tx.from?.hash ? getAddress(tx.from.hash) : undefined;
  const to = tx.to?.hash ? getAddress(tx.to.hash) : undefined;
  const direction = inferDirection(wallet, from, to);
  const counterparty = direction === "out" ? to : direction === "in" ? from : undefined;
  const valueWei = tx.value && /^\d+$/.test(tx.value) ? BigInt(tx.value) : 0n;

  return {
    hash: tx.hash ?? "unknown",
    direction,
    counterparty,
    method: tx.method || "transfer",
    valueEth: formatEther(valueWei),
    status: tx.status || tx.result || "unknown",
    timestamp: tx.timestamp,
    blockNumber: tx.block_number,
  };
}

function inferDirection(
  wallet: string,
  from?: string,
  to?: string,
): WalletActivitySummary["recentTransactions"][number]["direction"] {
  if (from === wallet && to === wallet) {
    return "self";
  }
  if (from === wallet) {
    return "out";
  }
  if (to === wallet) {
    return "in";
  }
  return "unknown";
}

function buildSummary(transactions: WalletActivitySummary["recentTransactions"]) {
  if (transactions.length === 0) {
    return "No recent transactions were found for this wallet on the configured chain.";
  }

  const incoming = transactions.filter(tx => tx.direction === "in").length;
  const outgoing = transactions.filter(tx => tx.direction === "out").length;
  const failed = transactions.filter(tx => !["ok", "success"].includes(tx.status.toLowerCase())).length;
  const methods = new Map<string, number>();

  for (const tx of transactions) {
    methods.set(tx.method, (methods.get(tx.method) ?? 0) + 1);
  }

  const topMethods = [...methods.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([method, count]) => `${method} (${count})`)
    .join(", ");

  const latest = transactions[0];
  const latestDirection = {
    in: "incoming",
    out: "outgoing",
    self: "self-directed",
    unknown: "unknown-direction",
  }[latest.direction];
  const latestText = latest.timestamp
    ? ` Most recent activity was ${latestDirection} on ${latest.timestamp}.`
    : "";

  return `Recent activity shows ${transactions.length} transactions: ${outgoing} outgoing, ${incoming} incoming, ${failed} not marked ok. Common methods: ${topMethods}.${latestText}`;
}
