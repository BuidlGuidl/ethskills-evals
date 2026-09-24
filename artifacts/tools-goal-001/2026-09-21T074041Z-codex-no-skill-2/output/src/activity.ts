import { isAddress } from "viem";
import { config } from "./config.js";

type BlockscoutAddress = {
  hash?: string;
  is_contract?: boolean;
  coin_balance?: string | null;
};

type BlockscoutCounters = {
  transactions_count?: string | number | null;
  token_transfers_count?: string | number | null;
};

type BlockscoutTx = {
  hash: string;
  timestamp?: string;
  block_number?: number;
  from?: { hash?: string; name?: string | null };
  to?: { hash?: string; name?: string | null } | null;
  method?: string | null;
  value?: string | null;
  fee?: { value?: string | null } | null;
  result?: string | null;
  status?: string | null;
};

type BlockscoutTokenTransfer = {
  tx_hash?: string;
  transaction_hash?: string;
  timestamp?: string;
  from?: { hash?: string; name?: string | null };
  to?: { hash?: string; name?: string | null } | null;
  total?: {
    value?: string | null;
    decimals?: string | number | null;
  } | null;
  token?: {
    symbol?: string | null;
    name?: string | null;
    decimals?: string | number | null;
    type?: string | null;
  } | null;
};

type ListResponse<T> = {
  items?: T[];
};

export type WalletActivitySummary = {
  wallet: string;
  chain: string;
  summary: string;
  latestTransactions: Array<{
    hash: string;
    when?: string;
    direction: "sent" | "received" | "self" | "contract";
    method: string;
    valueEth: string;
    status: string;
  }>;
  latestTokenTransfers: Array<{
    hash: string;
    when?: string;
    direction: "sent" | "received" | "self";
    token: string;
    amount: string;
  }>;
};

export async function summarizeWalletActivity(
  wallet: string,
): Promise<WalletActivitySummary> {
  if (!isAddress(wallet)) {
    throw new Error("wallet must be a valid EVM address");
  }

  const [address, counters, transactions, tokenTransfers] = await Promise.all([
    fetchBlockscout<BlockscoutAddress>(`/addresses/${wallet}`),
    fetchBlockscout<BlockscoutCounters>(`/addresses/${wallet}/counters`),
    fetchBlockscout<ListResponse<BlockscoutTx>>(
      `/addresses/${wallet}/transactions`,
    ),
    fetchBlockscout<ListResponse<BlockscoutTokenTransfer>>(
      `/addresses/${wallet}/token-transfers?type=ERC-20`,
    ),
  ]);

  const lowerWallet = wallet.toLowerCase();
  const latestTransactions = (transactions.items ?? [])
    .slice(0, 5)
    .map((tx) => ({
      hash: tx.hash,
      when: tx.timestamp,
      direction: transactionDirection(tx, lowerWallet),
      method: tx.method ?? "transfer",
      valueEth: formatAtomic(tx.value ?? "0", 18),
      status: tx.result ?? tx.status ?? "unknown",
    }));

  const latestTokenTransfers = (tokenTransfers.items ?? [])
    .slice(0, 5)
    .map((transfer) => ({
      hash: transfer.tx_hash ?? transfer.transaction_hash ?? "",
      when: transfer.timestamp,
      direction: tokenTransferDirection(transfer, lowerWallet),
      token: transfer.token?.symbol ?? transfer.token?.name ?? "token",
      amount: formatTokenAmount(transfer),
    }))
    .filter((transfer) => transfer.hash.length > 0);

  return {
    wallet,
    chain: networkName(config.X402_NETWORK),
    summary: buildSummary(
      address,
      counters,
      latestTransactions,
      latestTokenTransfers,
    ),
    latestTransactions,
    latestTokenTransfers,
  };
}

async function fetchBlockscout<T>(path: string): Promise<T> {
  const base = config.BLOCKSCOUT_API_BASE.replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Blockscout ${response.status} for ${path}: ${body.slice(0, 200)}`,
    );
  }

  return (await response.json()) as T;
}

function buildSummary(
  address: BlockscoutAddress,
  counters: BlockscoutCounters,
  transactions: WalletActivitySummary["latestTransactions"],
  tokenTransfers: WalletActivitySummary["latestTokenTransfers"],
): string {
  const txCount = counters.transactions_count ?? "unknown";
  const transferCount = counters.token_transfers_count ?? "unknown";
  const contractLabel = address.is_contract ? "contract" : "wallet";

  if (transactions.length === 0 && tokenTransfers.length === 0) {
    return `This ${contractLabel} has ${counterSummary(
      txCount,
      transferCount,
      false,
    )}, and no recent transactions or ERC-20 transfers were returned by the explorer.`;
  }

  const txPhrase =
    transactions.length > 0
      ? `${transactions.length} recent transaction${plural(transactions.length)}, mostly ${topDirections(
          transactions.map((tx) => tx.direction),
        )}`
      : "no recent native transactions";
  const tokenPhrase =
    tokenTransfers.length > 0
      ? `${tokenTransfers.length} recent ERC-20 transfer${plural(
          tokenTransfers.length,
        )}, involving ${uniqueSymbols(tokenTransfers).join(", ")}`
      : "no recent ERC-20 transfers";

  return `This ${contractLabel} has ${counterSummary(
    txCount,
    transferCount,
    true,
  )}. Recent activity shows ${txPhrase} and ${tokenPhrase}.`;
}

function counterSummary(
  txCount: string | number,
  transferCount: string | number,
  hasRecentItems: boolean,
): string {
  if (
    hasRecentItems &&
    Number(txCount) === 0 &&
    Number(transferCount) === 0
  ) {
    return "recent explorer activity, though aggregate counters are sparse";
  }

  return `${txCount} indexed transactions and ${transferCount} indexed token transfers`;
}

function transactionDirection(
  tx: BlockscoutTx,
  wallet: string,
): "sent" | "received" | "self" | "contract" {
  const from = tx.from?.hash?.toLowerCase();
  const to = tx.to?.hash?.toLowerCase();

  if (from === wallet && to === wallet) return "self";
  if (from === wallet) return "sent";
  if (to === wallet) return "received";
  return "contract";
}

function tokenTransferDirection(
  transfer: BlockscoutTokenTransfer,
  wallet: string,
): "sent" | "received" | "self" {
  const from = transfer.from?.hash?.toLowerCase();
  const to = transfer.to?.hash?.toLowerCase();

  if (from === wallet && to === wallet) return "self";
  if (from === wallet) return "sent";
  return "received";
}

function formatTokenAmount(transfer: BlockscoutTokenTransfer): string {
  const value = transfer.total?.value ?? "0";
  const decimals =
    transfer.total?.decimals ?? transfer.token?.decimals ?? "0";

  return formatAtomic(value, Number(decimals));
}

function formatAtomic(value: string, decimals: number): string {
  const raw = BigInt(value || "0");
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;

  if (fraction === 0n) return whole.toString();

  const padded = fraction.toString().padStart(decimals, "0");
  const trimmed = padded.replace(/0+$/, "").slice(0, 6);
  return `${whole}.${trimmed}`;
}

function uniqueSymbols(
  transfers: WalletActivitySummary["latestTokenTransfers"],
): string[] {
  return Array.from(new Set(transfers.map((transfer) => transfer.token))).slice(
    0,
    3,
  );
}

function topDirections(directions: string[]): string {
  const counts = directions.reduce<Record<string, number>>((acc, direction) => {
    acc[direction] = (acc[direction] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([direction]) => direction)
    .slice(0, 2)
    .join("/");
}

function plural(count: number): string {
  return count === 1 ? "" : "s";
}

function networkName(network: string): string {
  if (network === "eip155:8453") return "Base";
  if (network === "eip155:84532") return "Base Sepolia";
  return network;
}
