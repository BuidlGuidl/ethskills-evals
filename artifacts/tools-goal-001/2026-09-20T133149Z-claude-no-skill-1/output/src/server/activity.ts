import { createPublicClient, formatEther, formatUnits, http, getAddress, type Address } from "viem";
import { chainFor, type SupportedNetwork } from "../config.js";

export interface ActivityEvent {
  hash: string;
  timestamp: string;
  kind: "transfer" | "contract-call" | "token-transfer" | "contract-deploy";
  direction: "in" | "out" | "self";
  counterparty: string | null;
  /** Human-readable value, e.g. "0.05 ETH" or "25 USDC". */
  value: string | null;
  method: string | null;
  failed: boolean;
}

export interface ActivitySummary {
  address: Address;
  network: SupportedNetwork;
  generatedAt: string;
  /** One-paragraph natural-language summary, ready to drop into an agent's context. */
  summary: string;
  account: {
    /** "eoa-delegated" is an EOA that has an EIP-7702 delegation installed. */
    type: "eoa" | "eoa-delegated" | "contract";
    /** Implementation an EIP-7702 EOA points at, when type is "eoa-delegated". */
    delegatedTo: string | null;
    ethBalance: string;
    outgoingTxCount: number;
  };
  activity: {
    /** "indexer" = full history via Blockscout; "rpc-only" = balance and nonce only. */
    source: "indexer" | "rpc-only";
    windowDays: number | null;
    /** Native transactions sent or received in the window. */
    txCount: number;
    /** ERC-20 transfers in the window; these can occur without a native tx. */
    tokenTransferCount: number;
    firstSeen: string | null;
    lastSeen: string | null;
    uniqueCounterparties: number;
    tokensTouched: string[];
    recent: ActivityEvent[];
  };
}

/** Airdropped spam can touch dozens of tokens; keep the summary readable. */
const MAX_TOKEN_SYMBOLS = 8;

const BLOCKSCOUT_URL: Record<SupportedNetwork, string> = {
  base: "https://base.blockscout.com",
  "base-sepolia": "https://base-sepolia.blockscout.com",
};

interface BlockscoutAddress {
  hash: string;
  is_contract: boolean;
  name: string | null;
}

interface BlockscoutTx {
  hash: string;
  timestamp: string;
  value: string;
  status: "ok" | "error" | null;
  method: string | null;
  from: BlockscoutAddress;
  to: BlockscoutAddress | null;
  created_contract: BlockscoutAddress | null;
  transaction_types: string[];
}

interface BlockscoutTokenTransfer {
  transaction_hash: string;
  timestamp: string;
  from: BlockscoutAddress;
  to: BlockscoutAddress;
  total: { value: string; decimals: string | null };
  token: { symbol: string | null; decimals: string | null };
}

/**
 * Blockscout's public instances index Base and Base Sepolia and need no API key,
 * which keeps this service deployable with zero credentials.
 */
async function blockscout<T>(
  network: SupportedNetwork,
  path: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const url = new URL(path, BLOCKSCOUT_URL[network]);
  url.search = new URLSearchParams(params).toString();

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  // An address with no history at all 404s rather than returning an empty list.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Blockscout HTTP ${res.status} for ${path}`);

  const body = (await res.json()) as { items?: T[] };
  return body.items ?? [];
}

const directionOf = (address: Address, from: string, to: string | undefined): ActivityEvent["direction"] => {
  const me = address.toLowerCase();
  const isFrom = from?.toLowerCase() === me;
  const isTo = to?.toLowerCase() === me;
  if (isFrom && isTo) return "self";
  return isFrom ? "out" : "in";
};

function toEvent(address: Address, tx: BlockscoutTx): ActivityEvent {
  const counterparty = tx.created_contract ?? tx.to;
  const kind: ActivityEvent["kind"] = tx.created_contract
    ? "contract-deploy"
    : tx.method || tx.to?.is_contract
      ? "contract-call"
      : "transfer";
  return {
    hash: tx.hash,
    timestamp: tx.timestamp,
    kind,
    direction: directionOf(address, tx.from.hash, tx.to?.hash),
    counterparty: counterparty ? (counterparty.name ?? counterparty.hash) : null,
    value: tx.value !== "0" ? `${formatEther(BigInt(tx.value))} ETH` : null,
    method: tx.method,
    failed: tx.status === "error",
  };
}

function toTokenEvent(address: Address, tr: BlockscoutTokenTransfer): ActivityEvent {
  const direction = directionOf(address, tr.from.hash, tr.to.hash);
  const decimals = Number(tr.total.decimals ?? tr.token.decimals ?? "18");
  const other = direction === "out" ? tr.to : tr.from;
  return {
    hash: tr.transaction_hash,
    timestamp: tr.timestamp,
    kind: "token-transfer",
    direction,
    counterparty: other.name ?? other.hash,
    value: `${formatUnits(BigInt(tr.total.value), decimals)} ${tr.token.symbol ?? "?"}`,
    method: null,
    failed: false,
  };
}

/**
 * EIP-7702 delegations store `0xef0100 || implementation` at an EOA, so non-empty
 * bytecode alone would misreport a delegated EOA as a contract.
 */
function classifyAccount(code: string | undefined): {
  type: ActivitySummary["account"]["type"];
  delegatedTo: string | null;
} {
  if (!code || code === "0x") return { type: "eoa", delegatedTo: null };
  if (code.startsWith("0xef0100") && code.length === 48) {
    return { type: "eoa-delegated", delegatedTo: `0x${code.slice(8)}` };
  }
  return { type: "contract", delegatedTo: null };
}

function buildNarrative(s: Omit<ActivitySummary, "summary">): string {
  const { account, activity, address } = s;
  const label =
    account.type === "contract"
      ? "Contract"
      : account.type === "eoa-delegated"
        ? "Smart wallet (EIP-7702 delegated EOA)"
        : "Wallet";
  const parts: string[] = [];

  if (activity.source === "rpc-only") {
    return (
      `${label} ${address} holds ${account.ethBalance} ETH and has sent ` +
      `${account.outgoingTxCount} transaction(s) on ${s.network}. Transaction history ` +
      `was unavailable for this request, so no per-transaction detail is included.`
    );
  }

  if (activity.txCount === 0 && activity.tokenTransferCount === 0) {
    return (
      `${label} ${address} shows no activity in the last ${activity.windowDays} days ` +
      `on ${s.network}. It currently holds ${account.ethBalance} ETH.`
    );
  }

  const moves = [
    activity.txCount > 0 ? `${activity.txCount} transaction(s)` : null,
    activity.tokenTransferCount > 0 ? `${activity.tokenTransferCount} token transfer(s)` : null,
  ].filter(Boolean);

  parts.push(
    `${label} ${address} recorded ${moves.join(" and ")} in the last ` +
      `${activity.windowDays} days on ${s.network}, involving ` +
      `${activity.uniqueCounterparties} unique address(es).`,
  );

  const failures = activity.recent.filter((e) => e.failed).length;
  if (failures > 0) parts.push(`${failures} of the most recent transactions reverted.`);

  if (activity.tokensTouched.length > 0) {
    const shown = activity.tokensTouched.join(", ");
    const more = activity.tokensTouched.length === MAX_TOKEN_SYMBOLS ? " (and possibly others)" : "";
    parts.push(`Tokens moved: ${shown}${more}.`);
  }

  if (activity.txCount === 0 && activity.tokenTransferCount > 0) {
    parts.push("All movement was inbound token transfers, which are often unsolicited airdrops.");
  }

  parts.push(`Current balance is ${account.ethBalance} ETH.`);
  if (activity.lastSeen) parts.push(`Last active ${activity.lastSeen}.`);

  return parts.join(" ");
}

export interface SummarizeOptions {
  network: SupportedNetwork;
  rpcUrl?: string;
  limit?: number;
  windowDays?: number;
}

/**
 * Builds the product this endpoint sells: a compact, agent-readable description of
 * what a wallet has been doing recently.
 *
 * Balance and account type come from an RPC node; transaction history comes from
 * Blockscout, since a plain RPC node cannot answer "list this address's transactions".
 * If Blockscout is unreachable we still return the RPC-derived facts rather than failing.
 */
export async function summarizeWallet(
  rawAddress: string,
  opts: SummarizeOptions,
): Promise<ActivitySummary> {
  const address = getAddress(rawAddress); // throws on malformed input
  const chain = chainFor(opts.network);
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const windowDays = opts.windowDays ?? 30;

  const client = createPublicClient({
    chain,
    transport: http(opts.rpcUrl ?? chain.rpcUrls.default.http[0]),
  });

  const [balance, nonce, code] = await Promise.all([
    client.getBalance({ address }),
    client.getTransactionCount({ address }),
    client.getCode({ address }),
  ]);

  const base: Omit<ActivitySummary, "summary"> = {
    address,
    network: opts.network,
    generatedAt: new Date().toISOString(),
    account: {
      ...classifyAccount(code),
      ethBalance: formatEther(balance),
      outgoingTxCount: nonce,
    },
    activity: {
      source: "rpc-only",
      windowDays: null,
      txCount: 0,
      tokenTransferCount: 0,
      firstSeen: null,
      lastSeen: null,
      uniqueCounterparties: 0,
      tokensTouched: [],
      recent: [],
    },
  };

  try {
    const [txs, tokenTransfers] = await Promise.all([
      blockscout<BlockscoutTx>(opts.network, `/api/v2/addresses/${address}/transactions`),
      blockscout<BlockscoutTokenTransfer>(
        opts.network,
        `/api/v2/addresses/${address}/token-transfers`,
        { type: "ERC-20" },
      ),
    ]);

    const cutoff = Date.now() - windowDays * 86_400_000;
    const inWindow = (t: { timestamp: string }) => Date.parse(t.timestamp) >= cutoff;
    const windowTxs = txs.filter(inWindow);
    const windowTransfers = tokenTransfers.filter(inWindow);

    const recent = [
      ...windowTxs.map((t) => toEvent(address, t)),
      ...windowTransfers.map((t) => toTokenEvent(address, t)),
    ]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);

    const counterparties = new Set(
      recent.map((e) => e.counterparty?.toLowerCase()).filter((c): c is string => Boolean(c)),
    );
    const times = [...windowTxs, ...windowTransfers]
      .map((t) => t.timestamp)
      .sort((a, b) => a.localeCompare(b));

    base.activity = {
      source: "indexer",
      windowDays,
      txCount: windowTxs.length,
      tokenTransferCount: windowTransfers.length,
      firstSeen: times[0] ?? null,
      lastSeen: times[times.length - 1] ?? null,
      uniqueCounterparties: counterparties.size,
      tokensTouched: [
        ...new Set(windowTransfers.map((t) => t.token.symbol).filter((sym): sym is string => Boolean(sym))),
      ].slice(0, MAX_TOKEN_SYMBOLS),
      recent,
    };
  } catch (error) {
    // Degrade to the RPC-only summary rather than losing the whole response.
    console.warn(`[activity] indexer unavailable for ${address}:`, error);
  }

  return { ...base, summary: buildNarrative(base) };
}
