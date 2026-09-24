import { formatEther, getAddress, isAddress } from "viem";
import { chain } from "./config.js";

/** Shape returned to the paying agent. Kept small and stable — it's the product. */
export type ActivitySummary = {
  address: `0x${string}`;
  network: string;
  nativeBalanceEth: string;
  transactionsAnalyzed: number;
  firstSeen: string | null;
  lastSeen: string | null;
  outgoing: number;
  incoming: number;
  failed: number;
  topCounterparties: { address: string; interactions: number }[];
  topMethods: { method: string; calls: number }[];
  summary: string;
};

type BlockscoutTx = {
  hash: string;
  timestamp: string | null;
  from?: { hash?: string } | null;
  to?: { hash?: string } | null;
  method?: string | null;
  status?: string | null;
  result?: string | null;
};

const DEFAULT_LIMIT = 25;

async function blockscout<T>(path: string): Promise<T> {
  const url = `${chain().blockscout}${path}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Blockscout ${res.status} for ${path}`);
  return (await res.json()) as T;
}

function top<T>(counts: Map<string, number>, make: (name: string, n: number) => T, take = 3): T[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([name, n]) => make(name, n));
}

/**
 * Builds the wallet activity summary from Blockscout. No API key needed, which
 * keeps the service itself accountless — same property we sell to the caller.
 */
export async function summarizeWallet(
  rawAddress: string,
  limit = DEFAULT_LIMIT,
): Promise<ActivitySummary> {
  if (!isAddress(rawAddress)) throw new BadAddressError(rawAddress);
  const address = getAddress(rawAddress);

  const [info, txs] = await Promise.all([
    blockscout<{ coin_balance?: string }>(`/api/v2/addresses/${address}`).catch(
      () => ({}) as { coin_balance?: string },
    ),
    // Not wrapped in .catch: if we can't read transactions there is nothing
    // worth charging for, so the failure must reach the caller as a 502.
    blockscout<{ items?: BlockscoutTx[] }>(`/api/v2/addresses/${address}/transactions`),
  ]);

  const items = (txs.items ?? []).slice(0, limit);
  const lower = address.toLowerCase();

  const counterparties = new Map<string, number>();
  const methods = new Map<string, number>();
  let outgoing = 0;
  let incoming = 0;
  let failed = 0;

  for (const tx of items) {
    const from = tx.from?.hash?.toLowerCase();
    const to = tx.to?.hash?.toLowerCase();
    const isOut = from === lower;
    if (isOut) outgoing++;
    else incoming++;
    if (tx.status === "error" || tx.result === "error") failed++;

    const other = isOut ? to : from;
    if (other) counterparties.set(other, (counterparties.get(other) ?? 0) + 1);

    const method = tx.method ?? "transfer";
    methods.set(method, (methods.get(method) ?? 0) + 1);
  }

  // Blockscout returns newest first.
  const timestamps = items.map(tx => tx.timestamp).filter((t): t is string => Boolean(t));
  const lastSeen = timestamps[0] ?? null;
  const firstSeen = timestamps[timestamps.length - 1] ?? null;

  const balanceEth = info.coin_balance ? formatEther(BigInt(info.coin_balance)) : "0";
  const topCounterparties = top(counterparties, (address, interactions) => ({ address, interactions }));
  const topMethods = top(methods, (method, calls) => ({ method, calls }));

  const summary = items.length
    ? `${address} has ${items.length} recent transactions on ${chain().blockscout.replace("https://", "")} ` +
      `(${outgoing} outgoing, ${incoming} incoming, ${failed} failed), holds ${Number(balanceEth).toFixed(5)} ETH, ` +
      `and most often calls ${topMethods.map(m => m.method).join(", ") || "n/a"}. ` +
      `Last activity ${lastSeen ?? "unknown"}.`
    : `${address} has no indexed transactions on this network and holds ${Number(balanceEth).toFixed(5)} ETH.`;

  return {
    address,
    network: chain().network,
    nativeBalanceEth: balanceEth,
    transactionsAnalyzed: items.length,
    firstSeen,
    lastSeen,
    outgoing,
    incoming,
    failed,
    topCounterparties,
    topMethods,
    summary,
  };
}

export class BadAddressError extends Error {
  constructor(value: string) {
    super(`"${value}" is not a valid EVM address`);
    this.name = "BadAddressError";
  }
}
