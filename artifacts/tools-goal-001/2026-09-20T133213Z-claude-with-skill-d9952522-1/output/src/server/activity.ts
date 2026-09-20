/**
 * Wallet activity summary, built from the Blockscout REST API for the configured chain.
 * Application code is the consumer here, so this uses the indexed REST interface rather
 * than raw logs. (An agent talking to Blockscout directly would use the MCP server at
 * https://mcp.blockscout.com/mcp instead.)
 */

const MAX_ITEMS = 5;

type BlockscoutAddress = { hash: string };

type BlockscoutTx = {
  hash: string;
  timestamp: string | null;
  method: string | null;
  value: string;
  status: string | null;
  from: BlockscoutAddress | null;
  to: BlockscoutAddress | null;
};

type BlockscoutTransfer = {
  transaction_hash: string;
  timestamp: string | null;
  from: BlockscoutAddress | null;
  to: BlockscoutAddress | null;
  total?: { value?: string; decimals?: string | number | null } | null;
  token?: { symbol?: string | null; name?: string | null; address_hash?: string | null } | null;
};

export type ActivitySummary = {
  address: string;
  network: string;
  summary: string;
  counters: { transactions: number; tokenTransfers: number };
  nativeBalance: string;
  recentTransactions: Array<{
    hash: string;
    timestamp: string | null;
    direction: "in" | "out" | "self";
    counterparty: string | null;
    method: string | null;
    valueWei: string;
    status: string | null;
  }>;
  recentTokenTransfers: Array<{
    hash: string;
    timestamp: string | null;
    direction: "in" | "out" | "self";
    counterparty: string | null;
    amount: string | null;
    token: string | null;
  }>;
  source: string;
  generatedAt: string;
};

export class UpstreamError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

async function get<T>(base: string, path: string): Promise<T | null> {
  const res = await fetch(`${base}${path}`, { headers: { accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new UpstreamError(`Blockscout ${path} returned ${res.status}`);
  return (await res.json()) as T;
}

function direction(address: string, from?: string | null, to?: string | null) {
  const a = address.toLowerCase();
  const isFrom = from?.toLowerCase() === a;
  const isTo = to?.toLowerCase() === a;
  if (isFrom && isTo) return "self" as const;
  return isFrom ? ("out" as const) : ("in" as const);
}

function formatAmount(total: BlockscoutTransfer["total"]): string | null {
  if (!total?.value) return null;
  const decimals = Number(total.decimals ?? 18);
  if (!Number.isFinite(decimals)) return total.value;
  const raw = BigInt(total.value);
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export async function getWalletActivity(
  address: string,
  network: { name: string; blockscout: string },
): Promise<ActivitySummary> {
  const path = `/api/v2/addresses/${address}`;

  const [info, counters, txs, transfers] = await Promise.all([
    get<{ coin_balance?: string | null }>(network.blockscout, path),
    get<{ transactions_count?: string; token_transfers_count?: string }>(network.blockscout, `${path}/counters`),
    get<{ items?: BlockscoutTx[] }>(network.blockscout, `${path}/transactions`),
    get<{ items?: BlockscoutTransfer[] }>(network.blockscout, `${path}/token-transfers`),
  ]);

  const recentTransactions = (txs?.items ?? []).slice(0, MAX_ITEMS).map(tx => ({
    hash: tx.hash,
    timestamp: tx.timestamp,
    direction: direction(address, tx.from?.hash, tx.to?.hash),
    counterparty:
      direction(address, tx.from?.hash, tx.to?.hash) === "out"
        ? tx.to?.hash ?? null
        : tx.from?.hash ?? null,
    method: tx.method,
    valueWei: tx.value,
    status: tx.status,
  }));

  const recentTokenTransfers = (transfers?.items ?? []).slice(0, MAX_ITEMS).map(t => ({
    hash: t.transaction_hash,
    timestamp: t.timestamp,
    direction: direction(address, t.from?.hash, t.to?.hash),
    counterparty:
      direction(address, t.from?.hash, t.to?.hash) === "out"
        ? t.to?.hash ?? null
        : t.from?.hash ?? null,
    amount: formatAmount(t.total),
    token: t.token?.symbol ?? t.token?.name ?? null,
  }));

  const txCount = Number(counters?.transactions_count ?? 0);
  const transferCount = Number(counters?.token_transfers_count ?? 0);
  const lastSeen = recentTransactions[0]?.timestamp ?? recentTokenTransfers[0]?.timestamp ?? null;
  const tokens = [...new Set(recentTokenTransfers.map(t => t.token).filter(Boolean))];

  // Blockscout's counters lag behind the transaction lists for some addresses, so the
  // sentence leads with what the lists actually show and reports counters separately.
  const summary = info
    ? `${address} on ${network.name}: ${recentTransactions.length} recent transactions and ` +
      `${recentTokenTransfers.length} recent token transfers` +
      (lastSeen ? `, last activity ${lastSeen}.` : ", no recent activity.") +
      (tokens.length ? ` Recent tokens: ${tokens.join(", ")}.` : "") +
      ` Indexed totals: ${txCount} transactions, ${transferCount} token transfers.`
    : `${address} has no indexed activity on ${network.name}.`;

  return {
    address,
    network: network.name,
    summary,
    counters: { transactions: txCount, tokenTransfers: transferCount },
    nativeBalance: info?.coin_balance ?? "0",
    recentTransactions,
    recentTokenTransfers,
    source: network.blockscout,
    generatedAt: new Date().toISOString(),
  };
}
