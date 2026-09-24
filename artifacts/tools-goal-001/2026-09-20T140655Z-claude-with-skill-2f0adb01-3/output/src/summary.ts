import { formatEther, formatUnits, getAddress, isAddress } from "viem";
import { chain } from "./config.js";

/** Only the Blockscout fields this summary actually reads. */
type BlockscoutTx = {
  hash: string;
  timestamp: string | null;
  value: string;
  result: string;
  method: string | null;
  from: { hash: string; name: string | null; is_contract: boolean };
  to: { hash: string; name: string | null; ens_domain_name: string | null } | null;
};

type BlockscoutTokenTransfer = {
  token: { symbol: string | null; decimals: string | null };
  total: { value: string | null; decimals: string | null };
  from: { hash: string };
  to: { hash: string };
};

export type WalletSummary = {
  address: string;
  network: string;
  chainId: number;
  summary: string;
  nativeBalanceEth: string;
  transactionCount: number;
  lastActivityAt: string | null;
  counterparties: string[];
  tokens: string[];
  explorerUrl: string;
  generatedAt: string;
};

export class BadAddressError extends Error {}

const TX_WINDOW = 25;

async function blockscout<T>(path: string): Promise<T> {
  const res = await fetch(`${chain.blockscout}/api/v2${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Blockscout ${path} responded ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Builds the product the caller is paying for: a short, human-readable digest of
 * a wallet's recent on-chain activity, plus the structured fields behind it.
 *
 * Reads come from the chain's public Blockscout instance, which needs no API key.
 */
export async function summarizeWallet(rawAddress: string): Promise<WalletSummary> {
  if (!isAddress(rawAddress)) {
    throw new BadAddressError(`"${rawAddress}" is not a valid EVM address`);
  }
  const address = getAddress(rawAddress);

  const [info, txs, transfers] = await Promise.all([
    blockscout<{ coin_balance: string | null }>(`/addresses/${address}`),
    blockscout<{ items: BlockscoutTx[] }>(`/addresses/${address}/transactions`),
    blockscout<{ items: BlockscoutTokenTransfer[] }>(
      `/addresses/${address}/token-transfers`,
    ).catch(() => ({ items: [] as BlockscoutTokenTransfer[] })),
  ]);

  const recent = txs.items.slice(0, TX_WINDOW);
  const nativeBalanceEth = formatEther(BigInt(info.coin_balance ?? "0"));
  const lastActivityAt = recent[0]?.timestamp ?? null;

  const sent = recent.filter((tx) => sameAddress(tx.from.hash, address));
  const received = recent.length - sent.length;
  const failed = recent.filter((tx) => tx.result !== "success").length;

  const counterparties = topN(
    recent.map((tx) =>
      sameAddress(tx.from.hash, address)
        ? label(tx.to?.name, tx.to?.ens_domain_name, tx.to?.hash)
        : label(tx.from.name, null, tx.from.hash),
    ),
    3,
  );

  const tokens = topN(
    transfers.items
      .slice(0, 50)
      .map((t) => t.token.symbol)
      .filter((s): s is string => Boolean(s)),
    5,
  );

  const methods = topN(
    recent.map((tx) => tx.method).filter((m): m is string => Boolean(m)),
    3,
  );

  const netFlow = recent.reduce((acc, tx) => {
    const value = BigInt(tx.value ?? "0");
    return sameAddress(tx.from.hash, address) ? acc - value : acc + value;
  }, 0n);

  return {
    address,
    network: chain.network,
    chainId: chain.chainId,
    summary: renderSummary({
      address,
      recentCount: recent.length,
      sent: sent.length,
      received,
      failed,
      lastActivityAt,
      nativeBalanceEth,
      netFlow,
      counterparties,
      tokens,
      methods,
    }),
    nativeBalanceEth,
    transactionCount: recent.length,
    lastActivityAt,
    counterparties,
    tokens,
    explorerUrl: `${chain.explorer}/address/${address}`,
    generatedAt: new Date().toISOString(),
  };
}

function renderSummary(d: {
  address: string;
  recentCount: number;
  sent: number;
  received: number;
  failed: number;
  lastActivityAt: string | null;
  nativeBalanceEth: string;
  netFlow: bigint;
  counterparties: string[];
  tokens: string[];
  methods: string[];
}): string {
  if (d.recentCount === 0) {
    return `${short(d.address)} has no transactions on this network and holds ${trim(d.nativeBalanceEth)} ETH.`;
  }

  const parts = [
    `${short(d.address)} has ${d.recentCount} recent transaction${d.recentCount === 1 ? "" : "s"} ` +
      `(${d.sent} sent, ${d.received} received${d.failed ? `, ${d.failed} failed` : ""}), ` +
      `last active ${d.lastActivityAt ? relative(d.lastActivityAt) : "unknown"}.`,
    `Balance ${trim(d.nativeBalanceEth)} ETH; net native flow over the window ` +
      `${d.netFlow >= 0n ? "+" : "-"}${trim(formatUnits(abs(d.netFlow), 18))} ETH.`,
  ];

  if (d.methods.length) parts.push(`Most-called methods: ${d.methods.join(", ")}.`);
  if (d.tokens.length) parts.push(`Tokens moved: ${d.tokens.join(", ")}.`);
  if (d.counterparties.length) {
    parts.push(`Top counterparties: ${d.counterparties.join(", ")}.`);
  }

  return parts.join(" ");
}

function label(name?: string | null, ens?: string | null, hash?: string): string {
  return name ?? ens ?? short(hash ?? "");
}

function short(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function abs(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function trim(value: string): string {
  const n = Number(value);
  if (n === 0) return "0";
  return n < 0.0001 ? n.toExponential(2) : String(Number(n.toFixed(4)));
}

function relative(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const hours = deltaMs / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(deltaMs / 60_000))}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Most frequent values first, de-duplicated, capped at `n`. */
function topN(values: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([v]) => v);
}
