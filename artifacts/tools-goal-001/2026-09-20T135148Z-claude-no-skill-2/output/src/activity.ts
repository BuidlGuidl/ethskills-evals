import { createPublicClient, formatEther, formatUnits, http, isAddress, type Address } from "viem";
import { CHAIN, ETHERSCAN_API_KEY, RPC_URL } from "./config.js";

const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

/** How many recent transfers the summary looks at. */
const WINDOW = 50;

/** Normalized view of one transfer, whichever indexer it came from. */
type Transfer = {
  hash: string;
  timestamp: string | null;
  from: string;
  to: string | null;
  symbol: string;
  contract?: string;
  /** Decimal amount, or null when the indexer doesn't give us decimals (NFTs). */
  amount: number | null;
  failed: boolean;
  /** Gas paid by this wallet, in wei. Only available from Etherscan. */
  gasWei?: bigint;
};

export type WalletSummary = {
  address: Address;
  network: string;
  chainId: number;
  summary: string;
  balance: { eth: string; wei: string };
  accountType: "eoa" | "contract";
  outboundTxCount: number;
  recent: {
    source: "etherscan-v2" | "alchemy" | "unavailable";
    note?: string;
    transfers?: number;
    failedTransfers?: number;
    gasSpentEth?: string;
    window?: { firstSeen: string | null; lastSeen: string | null };
    topCounterparties?: { address: string; interactions: number }[];
    assets?: { symbol: string; contract?: string; transfers: number; netAmount: number | null }[];
  };
  generatedAt: string;
};

export async function summarizeWallet(rawAddress: string): Promise<WalletSummary> {
  if (!isAddress(rawAddress)) throw new Error(`"${rawAddress}" is not a valid EVM address`);
  const address = rawAddress as Address;

  const [balance, nonce, code] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.getTransactionCount({ address }),
    publicClient.getCode({ address }),
  ]);
  const accountType = code && code !== "0x" ? "contract" : "eoa";

  const recent = await loadRecent(address);
  const summary = buildSentences({ address, accountType, balance, nonce, recent });

  return {
    address,
    network: CHAIN.name,
    chainId: CHAIN.id,
    summary,
    balance: { eth: formatEther(balance), wei: balance.toString() },
    accountType,
    outboundTxCount: nonce,
    recent,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * History providers
 * ------------------------------------------------------------------ */

async function loadRecent(address: Address): Promise<WalletSummary["recent"]> {
  const provider = pickProvider();
  if (!provider) {
    return {
      source: "unavailable",
      note:
        "No transaction-history provider configured. Point BASE_RPC_URL at an Alchemy URL, " +
        "or set ETHERSCAN_API_KEY, to include recent activity in the summary.",
    };
  }

  try {
    return { ...aggregate(address, await provider.load(address)), source: provider.name };
  } catch (err) {
    return {
      source: "unavailable",
      note: `History lookup via ${provider.name} failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function pickProvider(): { name: "alchemy" | "etherscan-v2"; load: (a: Address) => Promise<Transfer[]> } | null {
  // Alchemy first: its free tier covers Base mainnet, Etherscan's does not.
  if (/alchemy\.com/.test(RPC_URL)) return { name: "alchemy", load: loadFromAlchemy };
  if (ETHERSCAN_API_KEY) return { name: "etherscan-v2", load: loadFromEtherscan };
  return null;
}

type AlchemyTransfer = {
  hash: string;
  from: string;
  to: string | null;
  value: number | null;
  asset: string | null;
  rawContract?: { address?: string | null };
  metadata?: { blockTimestamp?: string };
};

async function loadFromAlchemy(address: Address): Promise<Transfer[]> {
  const base = {
    fromBlock: "0x0",
    category: ["external", "erc20", "erc721", "erc1155"],
    withMetadata: true,
    excludeZeroValue: false,
    maxCount: `0x${WINDOW.toString(16)}`,
    order: "desc",
  };

  const [sent, received] = await Promise.all([
    alchemyRpc({ ...base, fromAddress: address }),
    alchemyRpc({ ...base, toAddress: address }),
  ]);

  return [...sent, ...received]
    .map(
      (t): Transfer => ({
        hash: t.hash,
        timestamp: t.metadata?.blockTimestamp ?? null,
        from: t.from.toLowerCase(),
        to: t.to?.toLowerCase() ?? null,
        symbol: t.asset ?? "UNKNOWN",
        contract: t.rawContract?.address?.toLowerCase() ?? undefined,
        amount: t.value,
        // getAssetTransfers only returns transfers from successful txs.
        failed: false,
      }),
    )
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
    .slice(0, WINDOW);
}

async function alchemyRpc(params: Record<string, unknown>): Promise<AlchemyTransfer[]> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers", params: [params] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { error?: { message: string }; result?: { transfers: AlchemyTransfer[] } };
  if (body.error) throw new Error(body.error.message);
  return body.result?.transfers ?? [];
}

type EtherscanTx = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  isError?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  contractAddress?: string;
};

async function loadFromEtherscan(address: Address): Promise<Transfer[]> {
  const me = address.toLowerCase();
  const common = { address, startblock: "0", endblock: "99999999", page: "1", offset: String(WINDOW), sort: "desc" };

  const [txs, tokenTxs] = await Promise.all([
    etherscan({ module: "account", action: "txlist", ...common }),
    etherscan({ module: "account", action: "tokentx", ...common }),
  ]);

  const native = txs.map(
    (t): Transfer => ({
      hash: t.hash,
      timestamp: new Date(Number(t.timeStamp) * 1000).toISOString(),
      from: t.from.toLowerCase(),
      to: t.to?.toLowerCase() || null,
      symbol: "ETH",
      amount: Number(formatEther(BigInt(t.value))),
      failed: t.isError === "1",
      gasWei: t.from.toLowerCase() === me ? BigInt(t.gasUsed) * BigInt(t.gasPrice) : 0n,
    }),
  );

  const tokens = tokenTxs.map(
    (t): Transfer => ({
      hash: t.hash,
      timestamp: new Date(Number(t.timeStamp) * 1000).toISOString(),
      from: t.from.toLowerCase(),
      to: t.to?.toLowerCase() || null,
      symbol: t.tokenSymbol || "UNKNOWN",
      contract: t.contractAddress?.toLowerCase(),
      amount: Number(formatUnits(BigInt(t.value), Number(t.tokenDecimal) || 18)),
      failed: false,
    }),
  );

  return [...native, ...tokens].sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? "")).slice(0, WINDOW);
}

async function etherscan(params: Record<string, string>): Promise<EtherscanTx[]> {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", String(CHAIN.id));
  url.searchParams.set("apikey", ETHERSCAN_API_KEY!);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { status: string; message: string; result: EtherscanTx[] | string };

  if (body.status !== "1") {
    // "No transactions found" is an empty result, not a failure.
    if (typeof body.result === "string" && !/no transactions found/i.test(body.message)) {
      throw new Error(body.result);
    }
    return [];
  }
  return body.result as EtherscanTx[];
}

/* ------------------------------------------------------------------ *
 * Aggregation + prose
 * ------------------------------------------------------------------ */

function aggregate(address: Address, transfers: Transfer[]): Omit<WalletSummary["recent"], "source"> {
  const me = address.toLowerCase();

  const counterparties = new Map<string, number>();
  const assets = new Map<string, { symbol: string; contract?: string; transfers: number; net: number | null }>();
  let gasWei = 0n;
  let failed = 0;

  for (const t of transfers) {
    if (t.failed) failed++;
    if (t.gasWei) gasWei += t.gasWei;

    const other = t.from === me ? t.to : t.from;
    if (other) counterparties.set(other, (counterparties.get(other) ?? 0) + 1);

    const key = t.contract ?? t.symbol;
    const entry = assets.get(key) ?? { symbol: t.symbol, contract: t.contract, transfers: 0, net: 0 };
    entry.transfers++;
    if (entry.net !== null && t.amount !== null) {
      entry.net += t.to === me ? t.amount : -t.amount;
    } else {
      entry.net = null; // amounts we can't normalize (e.g. NFTs) make the net meaningless
    }
    assets.set(key, entry);
  }

  const timestamps = transfers.map(t => t.timestamp).filter((t): t is string => !!t).sort();

  return {
    note: transfers.length >= WINDOW ? `Covers the ${WINDOW} most recent transfers only.` : undefined,
    transfers: transfers.length,
    failedTransfers: failed,
    gasSpentEth: gasWei > 0n ? formatEther(gasWei) : undefined,
    window: { firstSeen: timestamps[0] ?? null, lastSeen: timestamps.at(-1) ?? null },
    topCounterparties: [...counterparties.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([addr, interactions]) => ({ address: addr, interactions })),
    assets: [...assets.values()]
      .sort((a, b) => b.transfers - a.transfers)
      .slice(0, 5)
      .map(a => ({ symbol: a.symbol, contract: a.contract, transfers: a.transfers, netAmount: a.net })),
  };
}

function buildSentences(d: {
  address: Address;
  accountType: "eoa" | "contract";
  balance: bigint;
  nonce: number;
  recent: WalletSummary["recent"];
}): string {
  const parts = [
    `${d.address} is ${d.accountType === "contract" ? "a contract" : "an EOA"} on ${CHAIN.name} holding ` +
      `${Number(formatEther(d.balance)).toFixed(5)} ETH, with ${d.nonce} outbound transaction(s) all-time.`,
  ];

  const r = d.recent;
  if (r.source === "unavailable") {
    parts.push(`Recent transfer history was not included: ${r.note}`);
    return parts.join(" ");
  }
  if (!r.transfers) {
    parts.push("No recent transfers were found.");
    return parts.join(" ");
  }

  const from = r.window?.firstSeen?.slice(0, 10) ?? "?";
  const to = r.window?.lastSeen?.slice(0, 10) ?? "?";
  parts.push(
    `Its last ${r.transfers} transfer(s) run from ${from} to ${to}` +
      (r.gasSpentEth ? `, with ${Number(r.gasSpentEth).toFixed(6)} ETH spent on gas` : "") +
      (r.failedTransfers ? `, including ${r.failedTransfers} reverted transaction(s)` : "") +
      ".",
  );

  if (r.assets?.length) {
    parts.push(
      `Assets moved: ${r.assets
        .map(a => `${a.symbol} (${a.transfers} transfer(s)${a.netAmount === null ? "" : `, net ${round(a.netAmount)}`})`)
        .join(", ")}.`,
    );
  }
  if (r.topCounterparties?.length) {
    parts.push(`Most-touched addresses: ${r.topCounterparties.map(c => `${c.address} (${c.interactions}x)`).join(", ")}.`);
  }
  return parts.join(" ");
}

function round(n: number): string {
  return Math.abs(n) >= 1 ? n.toFixed(4) : n.toPrecision(4);
}
