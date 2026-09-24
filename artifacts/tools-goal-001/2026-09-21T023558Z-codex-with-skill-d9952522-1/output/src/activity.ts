import { formatEther, getAddress, isAddress } from "viem";

import { getBlockscoutBaseUrl, getNetworkName, getPaymentNetwork } from "./config.js";

type BlockscoutAddress = {
  hash?: string;
  ens_domain_name?: string | null;
  coin_balance?: string | null;
  transaction_count?: number | string;
};

type BlockscoutTx = {
  hash?: string;
  timestamp?: string;
  from?: { hash?: string; name?: string | null };
  to?: { hash?: string; name?: string | null } | null;
  value?: string | null;
  method?: string | null;
  decoded_input?: { method_call?: string | null } | null;
  result?: string | null;
  status?: string | null;
};

type BlockscoutTokenTransfer = {
  transaction_hash?: string;
  timestamp?: string;
  from?: { hash?: string };
  to?: { hash?: string };
  total?: {
    value?: string | null;
    decimals?: string | number | null;
  } | null;
  token?: {
    symbol?: string | null;
    name?: string | null;
    type?: string | null;
  } | null;
  type?: string | null;
};

type Paginated<T> = {
  items?: T[];
};

export type ActivitySummary = {
  wallet: `0x${string}`;
  chain: string;
  generatedAt: string;
  summary: string;
  nativeBalanceEth: string | null;
  explorer: string;
  recentTransactions: Array<{
    hash: string;
    timestamp: string | null;
    direction: "sent" | "received" | "self" | "contract";
    counterparty: string | null;
    method: string;
    valueEth: string;
    result: string;
  }>;
  tokenTransfers: Array<{
    transactionHash: string;
    timestamp: string | null;
    direction: "sent" | "received" | "self";
    token: string;
    amount: string | null;
    type: string;
  }>;
};

export async function summarizeWalletActivity(address: string): Promise<ActivitySummary> {
  if (!isAddress(address)) {
    throw new Error("address must be a valid EVM address");
  }

  const wallet = getAddress(address) as `0x${string}`;
  const network = getPaymentNetwork();
  const blockscoutBaseUrl = getBlockscoutBaseUrl(network);
  const chain = getNetworkName(network);

  const [account, txs, transfers] = await Promise.all([
    fetchBlockscout<BlockscoutAddress>(blockscoutBaseUrl, `/addresses/${wallet}`),
    fetchBlockscout<Paginated<BlockscoutTx>>(blockscoutBaseUrl, `/addresses/${wallet}/transactions`),
    fetchBlockscout<Paginated<BlockscoutTokenTransfer>>(
      blockscoutBaseUrl,
      `/addresses/${wallet}/token-transfers`,
    ),
  ]);

  const recentTransactions = (txs.items ?? []).slice(0, 6).map(tx => normalizeTx(wallet, tx));
  const tokenTransfers = (transfers.items ?? [])
    .slice(0, 6)
    .map(transfer => normalizeTransfer(wallet, transfer));
  const nativeBalanceEth = account.coin_balance ? formatWei(account.coin_balance) : null;

  return {
    wallet,
    chain,
    generatedAt: new Date().toISOString(),
    summary: buildSummary({
      wallet,
      chain,
      nativeBalanceEth,
      transactionCount: account.transaction_count,
      recentTransactions,
      tokenTransfers,
    }),
    nativeBalanceEth,
    explorer: `${blockscoutBaseUrl.replace(/\/api\/v2$/, "")}/address/${wallet}`,
    recentTransactions,
    tokenTransfers,
  };
}

async function fetchBlockscout<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Blockscout ${path} failed with ${response.status}: ${body.slice(0, 240)}`);
  }

  return response.json() as Promise<T>;
}

function normalizeTx(wallet: `0x${string}`, tx: BlockscoutTx): ActivitySummary["recentTransactions"][number] {
  const from = tx.from?.hash?.toLowerCase();
  const to = tx.to?.hash?.toLowerCase();
  const self = wallet.toLowerCase();
  const direction =
    from === self && to === self ? "self" : from === self ? "sent" : to === self ? "received" : "contract";

  return {
    hash: tx.hash ?? "",
    timestamp: tx.timestamp ?? null,
    direction,
    counterparty: direction === "sent" ? tx.to?.hash ?? null : direction === "received" ? tx.from?.hash ?? null : null,
    method: tx.method ?? tx.decoded_input?.method_call ?? "transfer",
    valueEth: tx.value ? formatWei(tx.value) : "0",
    result: tx.result ?? tx.status ?? "unknown",
  };
}

function normalizeTransfer(
  wallet: `0x${string}`,
  transfer: BlockscoutTokenTransfer,
): ActivitySummary["tokenTransfers"][number] {
  const from = transfer.from?.hash?.toLowerCase();
  const to = transfer.to?.hash?.toLowerCase();
  const self = wallet.toLowerCase();
  const direction = from === self && to === self ? "self" : from === self ? "sent" : "received";
  const symbol = transfer.token?.symbol || transfer.token?.name || "unknown token";
  const type = transfer.token?.type || transfer.type || "token";

  return {
    transactionHash: transfer.transaction_hash ?? "",
    timestamp: transfer.timestamp ?? null,
    direction,
    token: symbol,
    amount: formatTokenAmount(transfer.total?.value, transfer.total?.decimals),
    type,
  };
}

function buildSummary(input: {
  wallet: `0x${string}`;
  chain: string;
  nativeBalanceEth: string | null;
  transactionCount?: number | string;
  recentTransactions: ActivitySummary["recentTransactions"];
  tokenTransfers: ActivitySummary["tokenTransfers"];
}): string {
  const txCount = input.transactionCount ?? "unknown";
  const latestTx = input.recentTransactions[0];
  const latestTransfer = input.tokenTransfers[0];
  const balance = input.nativeBalanceEth ? `${input.nativeBalanceEth} ETH` : "unknown native balance";

  const parts = [
    `${shortAddress(input.wallet)} on ${input.chain} has ${balance} and ${txCount} indexed transactions.`,
  ];

  if (latestTx) {
    parts.push(
      `Latest transaction ${shortHash(latestTx.hash)} was ${latestTx.direction} ${latestTx.valueEth} ETH via ${latestTx.method} with result ${latestTx.result}.`,
    );
  }

  if (latestTransfer) {
    const amount = latestTransfer.amount ? `${latestTransfer.amount} ` : "";
    parts.push(
      `Most recent token movement was ${latestTransfer.direction} ${amount}${latestTransfer.token} (${latestTransfer.type}).`,
    );
  }

  if (!latestTx && !latestTransfer) {
    parts.push("Blockscout did not return recent transactions or token transfers for this wallet.");
  }

  return parts.join(" ");
}

function formatWei(value: string): string {
  try {
    return trimDecimal(formatEther(BigInt(value)), 6);
  } catch {
    return value;
  }
}

function formatTokenAmount(value?: string | null, decimals?: string | number | null): string | null {
  if (!value) {
    return null;
  }

  const places = Number(decimals ?? 0);
  if (!Number.isInteger(places) || places <= 0) {
    return value;
  }

  const padded = value.padStart(places + 1, "0");
  const whole = padded.slice(0, -places);
  const fraction = padded.slice(-places).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function trimDecimal(value: string, maxFractionDigits: number): string {
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash: string): string {
  return hash ? `${hash.slice(0, 10)}...` : "unknown";
}
