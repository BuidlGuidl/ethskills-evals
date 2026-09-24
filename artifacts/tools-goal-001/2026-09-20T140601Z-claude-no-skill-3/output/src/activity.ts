/**
 * The actual product: a short summary of a wallet's recent on-chain activity.
 *
 * Two tiers, so it runs with zero setup and gets better with a key:
 *  - Always: live chain state over JSON-RPC (balance, nonce, EOA vs contract).
 *  - With ETHERSCAN_API_KEY: recent transactions and token transfers, which is
 *    what makes the summary actually interesting.
 */
import { createPublicClient, http, formatEther, isAddress, getAddress } from "viem";
import { base, baseSepolia } from "viem/chains";
import { CHAIN_ID, ETHERSCAN_API_KEY, IS_MAINNET, NETWORK, RPC_URL } from "./config.js";

const publicClient = createPublicClient({
  chain: IS_MAINNET ? base : baseSepolia,
  transport: http(RPC_URL),
});

const MAX_TX = 100;

export type WalletSummary = {
  address: string;
  network: string;
  summary: string;
  balanceEth: string;
  isContract: boolean;
  transactionCount: number;
  recentActivity: {
    windowDays: number | null;
    transactions: number;
    outgoing: number;
    incoming: number;
    failed: number;
    gasSpentEth: string;
    uniqueCounterparties: number;
    topCounterparties: { address: string; interactions: number }[];
    tokens: { symbol: string; contract: string; transfers: number }[];
    lastActiveAt: string | null;
  } | null;
  generatedAt: string;
};

type EtherscanTx = {
  hash: string;
  from: string;
  to: string;
  timeStamp: string;
  isError: string;
  gasUsed: string;
  gasPrice: string;
};

type EtherscanTokenTx = {
  contractAddress: string;
  tokenSymbol: string;
  tokenDecimal: string;
  value: string;
};

async function etherscan<T>(action: string, address: string): Promise<T[]> {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", String(CHAIN_ID));
  url.searchParams.set("module", "account");
  url.searchParams.set("action", action);
  url.searchParams.set("address", address);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", String(MAX_TX));
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", ETHERSCAN_API_KEY);

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`explorer returned ${res.status}`);
  const body = (await res.json()) as { status: string; message: string; result: T[] | string };
  // status "0" with message "No transactions found" is a normal empty result.
  if (body.status !== "1") {
    if (typeof body.result === "string" && !/no transactions|no records/i.test(body.message)) {
      throw new Error(`explorer error: ${body.result}`);
    }
    return [];
  }
  return Array.isArray(body.result) ? body.result : [];
}

export class InvalidAddressError extends Error {}

export async function summarizeWallet(rawAddress: string): Promise<WalletSummary> {
  if (!isAddress(rawAddress)) {
    throw new InvalidAddressError(`"${rawAddress}" is not a valid EVM address`);
  }
  const address = getAddress(rawAddress);

  const [balance, nonce, code] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.getTransactionCount({ address }),
    publicClient.getCode({ address }),
  ]);
  const isContract = Boolean(code && code !== "0x");

  let recentActivity: WalletSummary["recentActivity"] = null;
  if (ETHERSCAN_API_KEY) {
    const [txs, tokenTxs] = await Promise.all([
      etherscan<EtherscanTx>("txlist", address),
      etherscan<EtherscanTokenTx>("tokentx", address),
    ]);
    recentActivity = buildActivity(address, txs, tokenTxs);
  }

  return {
    address,
    network: NETWORK,
    summary: renderSummary(address, formatEther(balance), isContract, nonce, recentActivity),
    balanceEth: formatEther(balance),
    isContract,
    transactionCount: nonce,
    recentActivity,
    generatedAt: new Date().toISOString(),
  };
}

function buildActivity(
  address: string,
  txs: EtherscanTx[],
  tokenTxs: EtherscanTokenTx[],
): NonNullable<WalletSummary["recentActivity"]> {
  const lower = address.toLowerCase();
  const counterparties = new Map<string, number>();
  let outgoing = 0;
  let incoming = 0;
  let failed = 0;
  let gasWei = 0n;

  for (const tx of txs) {
    const isOut = tx.from.toLowerCase() === lower;
    if (isOut) {
      outgoing++;
      gasWei += BigInt(tx.gasUsed || "0") * BigInt(tx.gasPrice || "0");
    } else {
      incoming++;
    }
    if (tx.isError === "1") failed++;

    const other = (isOut ? tx.to : tx.from)?.toLowerCase();
    if (other && other !== lower) {
      counterparties.set(other, (counterparties.get(other) ?? 0) + 1);
    }
  }

  const tokens = new Map<string, { symbol: string; contract: string; transfers: number }>();
  for (const t of tokenTxs) {
    const key = t.contractAddress.toLowerCase();
    const entry = tokens.get(key) ?? {
      symbol: t.tokenSymbol || "???",
      contract: getAddress(t.contractAddress),
      transfers: 0,
    };
    entry.transfers++;
    tokens.set(key, entry);
  }

  const timestamps = txs.map(t => Number(t.timeStamp)).filter(n => Number.isFinite(n) && n > 0);
  const newest = timestamps.length ? Math.max(...timestamps) : null;
  const oldest = timestamps.length ? Math.min(...timestamps) : null;

  return {
    windowDays: newest && oldest ? Math.max(1, Math.round((newest - oldest) / 86_400)) : null,
    transactions: txs.length,
    outgoing,
    incoming,
    failed,
    gasSpentEth: formatEther(gasWei),
    uniqueCounterparties: counterparties.size,
    topCounterparties: [...counterparties.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([addr, interactions]) => ({ address: getAddress(addr), interactions })),
    tokens: [...tokens.values()].sort((a, b) => b.transfers - a.transfers).slice(0, 5),
    lastActiveAt: newest ? new Date(newest * 1000).toISOString() : null,
  };
}

function renderSummary(
  address: string,
  balanceEth: string,
  isContract: boolean,
  nonce: number,
  activity: WalletSummary["recentActivity"],
): string {
  const kind = isContract ? "contract" : "EOA";
  const parts = [
    `${address} is a ${kind} on ${NETWORK} holding ${trim(balanceEth)} ETH with ${nonce} transactions sent all-time.`,
  ];

  if (!activity) {
    parts.push("Set ETHERSCAN_API_KEY on the server for recent-transaction detail.");
    return parts.join(" ");
  }

  if (activity.transactions === 0) {
    parts.push("No recent transactions found.");
    return parts.join(" ");
  }

  const window = activity.windowDays ? ` over the last ~${activity.windowDays} day(s)` : "";
  parts.push(
    `In its ${activity.transactions} most recent transactions${window}: ${activity.outgoing} outgoing, ` +
      `${activity.incoming} incoming, ${activity.failed} failed, ` +
      `${trim(activity.gasSpentEth)} ETH spent on gas across ${activity.uniqueCounterparties} distinct counterparties.`,
  );

  if (activity.tokens.length) {
    parts.push(`Most-moved tokens: ${activity.tokens.map(t => `${t.symbol} (${t.transfers})`).join(", ")}.`);
  }
  if (activity.lastActiveAt) {
    parts.push(`Last active ${activity.lastActiveAt}.`);
  }
  return parts.join(" ");
}

function trim(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n === 0 ? "0" : n.toFixed(6).replace(/\.?0+$/, "");
}

