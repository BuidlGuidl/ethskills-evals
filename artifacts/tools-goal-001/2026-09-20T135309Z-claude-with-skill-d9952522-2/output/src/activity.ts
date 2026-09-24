import { BLOCKSCOUT_API, CHAIN, EXPLORER_TX } from "./config.js";

/**
 * Wallet activity is read from the Blockscout REST API: application code is the
 * consumer here (the server renders the summary), so the indexed REST interface
 * fits better than the Blockscout MCP server, which is aimed at agents reading
 * onchain data directly.
 */

export interface ActivitySummary {
  address: string;
  chain: string;
  nativeBalanceEth: string;
  totalTransactions: number | null;
  lastActiveAt: string | null;
  recentTransactions: {
    hash: string;
    timestamp: string | null;
    direction: "in" | "out" | "self";
    counterparty: string | null;
    valueEth: string;
    method: string | null;
    status: string | null;
    explorerUrl: string;
  }[];
  recentTokens: { symbol: string; transfers: number }[];
  summary: string;
}

async function blockscout<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BLOCKSCOUT_API}${path}`, {
    headers: { accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Blockscout ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

function formatUnits(raw: string | null | undefined, decimals: number): string {
  if (!raw) return "0";
  const negative = raw.startsWith("-");
  const digits = (negative ? raw.slice(1) : raw).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Builds the short activity summary that callers are paying for. */
export async function getWalletActivity(
  address: string,
  limit = 5,
): Promise<ActivitySummary> {
  const lower = address.toLowerCase();

  const [info, counters, txs, transfers] = await Promise.all([
    blockscout<{ coin_balance?: string }>(`/addresses/${address}`),
    blockscout<{ transactions_count?: string }>(`/addresses/${address}/counters`),
    blockscout<{ items?: RawTx[] }>(`/addresses/${address}/transactions`),
    blockscout<{ items?: RawTransfer[] }>(`/addresses/${address}/token-transfers`),
  ]);

  const recentTransactions = (txs?.items ?? []).slice(0, limit).map(tx => {
    const from = tx.from?.hash?.toLowerCase() ?? null;
    const to = tx.to?.hash?.toLowerCase() ?? null;
    const direction: "in" | "out" | "self" =
      from === lower && to === lower ? "self" : from === lower ? "out" : "in";
    return {
      hash: tx.hash,
      timestamp: tx.timestamp ?? null,
      direction,
      counterparty: direction === "out" ? (tx.to?.hash ?? null) : (tx.from?.hash ?? null),
      valueEth: formatUnits(tx.value, 18),
      method: tx.method ?? null,
      status: tx.status ?? null,
      explorerUrl: `${EXPLORER_TX}${tx.hash}`,
    };
  });

  const tokenCounts = new Map<string, number>();
  for (const transfer of transfers?.items ?? []) {
    const symbol = transfer.token?.symbol;
    if (symbol) tokenCounts.set(symbol, (tokenCounts.get(symbol) ?? 0) + 1);
  }
  const recentTokens = [...tokenCounts.entries()]
    .map(([symbol, count]) => ({ symbol, transfers: count }))
    .sort((a, b) => b.transfers - a.transfers)
    .slice(0, 5);

  const nativeBalanceEth = formatUnits(info?.coin_balance, 18);
  const totalTransactions = counters?.transactions_count
    ? Number(counters.transactions_count)
    : null;
  const lastActiveAt = recentTransactions[0]?.timestamp ?? null;

  const parts = [
    `${address} on ${CHAIN} holds ${nativeBalanceEth} ETH`,
    totalTransactions !== null
      ? `across ${totalTransactions.toLocaleString("en-US")} lifetime transactions`
      : null,
    lastActiveAt ? `last active ${lastActiveAt}` : "with no transactions found",
    recentTokens.length
      ? `recent token activity: ${recentTokens.map(t => `${t.symbol} (${t.transfers})`).join(", ")}`
      : null,
  ].filter(Boolean);

  return {
    address,
    chain: CHAIN,
    nativeBalanceEth,
    totalTransactions,
    lastActiveAt,
    recentTransactions,
    recentTokens,
    summary: `${parts.join("; ")}.`,
  };
}

interface RawTx {
  hash: string;
  timestamp?: string;
  value?: string;
  method?: string;
  status?: string;
  from?: { hash?: string };
  to?: { hash?: string } | null;
}

interface RawTransfer {
  token?: { symbol?: string };
}
