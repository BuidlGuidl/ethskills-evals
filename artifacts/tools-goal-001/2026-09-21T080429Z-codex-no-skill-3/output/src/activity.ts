import { formatEther, getAddress, isAddress } from "viem";
import { env } from "./config.js";

type BlockscoutAddressRef = {
  hash?: string;
  name?: string | null;
  is_contract?: boolean;
};

type BlockscoutTokenTransfer = {
  token?: {
    symbol?: string | null;
    name?: string | null;
    decimals?: string | number | null;
  };
  total?: {
    value?: string;
    decimals?: string | number | null;
  };
};

type BlockscoutTransaction = {
  hash: string;
  timestamp?: string;
  block_number?: number;
  from?: BlockscoutAddressRef | null;
  to?: BlockscoutAddressRef | null;
  value?: string;
  fee?: { value?: string } | string;
  gas_used?: string;
  result?: string | null;
  status?: string | null;
  method?: string | null;
  token_transfers?: BlockscoutTokenTransfer[] | null;
};

type BlockscoutTransactionsResponse = {
  items: BlockscoutTransaction[];
};

export type ActivitySummary = {
  wallet: `0x${string}`;
  source: string;
  checkedAt: string;
  window: {
    transactionsRequested: number;
    transactionsReturned: number;
    latestActivityAt: string | null;
  };
  counts: {
    incoming: number;
    outgoing: number;
    selfTransfers: number;
    contractInteractions: number;
    failed: number;
    tokenTransfersSeen: number;
  };
  nativeEthFlow: {
    incoming: string;
    outgoing: string;
    net: string;
  };
  counterparties: string[];
  recent: Array<{
    hash: string;
    blockNumber: number | null;
    timestamp: string | null;
    direction: "incoming" | "outgoing" | "self" | "unknown";
    method: string;
    valueEth: string;
    counterparty: string | null;
    status: string;
    tokenTransfers: string[];
  }>;
  summary: string;
};

type ActivityDirection = ActivitySummary["recent"][number]["direction"];

export async function summarizeWalletActivity(
  walletInput: string,
  limit: number
): Promise<ActivitySummary> {
  if (!isAddress(walletInput)) {
    throw new Error("Invalid wallet address");
  }

  const wallet = getAddress(walletInput);
  const endpoint = new URL(`${trimTrailingSlash(env.BLOCKSCOUT_BASE_URL)}/addresses/${wallet}/transactions`);

  if (env.BLOCKSCOUT_API_KEY) {
    endpoint.searchParams.set("apikey", env.BLOCKSCOUT_API_KEY);
  }

  const response = await fetchWithTimeout(endpoint, 10_000);
  if (!response.ok) {
    throw new Error(`Blockscout returned ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as BlockscoutTransactionsResponse;
  const transactions = (payload.items ?? []).slice(0, limit);
  const walletLower = wallet.toLowerCase();
  let incoming = 0;
  let outgoing = 0;
  let selfTransfers = 0;
  let contractInteractions = 0;
  let failed = 0;
  let tokenTransfersSeen = 0;
  let nativeIncoming = 0n;
  let nativeOutgoing = 0n;
  const counterparties = new Set<string>();

  const recent = transactions.map(tx => {
    const from = tx.from?.hash ? getAddress(tx.from.hash) : null;
    const to = tx.to?.hash ? getAddress(tx.to.hash) : null;
    const value = BigInt(tx.value ?? "0");
    const fromWallet = from?.toLowerCase() === walletLower;
    const toWallet = to?.toLowerCase() === walletLower;
    const direction: ActivityDirection =
      fromWallet && toWallet ? "self" : fromWallet ? "outgoing" : toWallet ? "incoming" : "unknown";
    const status = tx.result ?? tx.status ?? "unknown";
    const txTokenTransfers = summarizeTokenTransfers(tx.token_transfers ?? []);

    if (direction === "incoming") {
      incoming += 1;
      nativeIncoming += value;
      if (from) counterparties.add(from);
    } else if (direction === "outgoing") {
      outgoing += 1;
      nativeOutgoing += value;
      if (to) counterparties.add(to);
    } else if (direction === "self") {
      selfTransfers += 1;
      nativeIncoming += value;
      nativeOutgoing += value;
    }

    if (value === 0n && tx.to?.is_contract) {
      contractInteractions += 1;
    }

    if (status !== "success" && status !== "ok") {
      failed += 1;
    }

    tokenTransfersSeen += txTokenTransfers.length;

    return {
      hash: tx.hash,
      blockNumber: tx.block_number ?? null,
      timestamp: tx.timestamp ?? null,
      direction,
      method: tx.method ?? "transfer",
      valueEth: formatEther(value),
      counterparty: direction === "incoming" ? from : direction === "outgoing" ? to : null,
      status,
      tokenTransfers: txTokenTransfers
    };
  });

  const net = nativeIncoming - nativeOutgoing;
  const latestActivityAt = recent[0]?.timestamp ?? null;

  return {
    wallet,
    source: endpoint.origin,
    checkedAt: new Date().toISOString(),
    window: {
      transactionsRequested: limit,
      transactionsReturned: transactions.length,
      latestActivityAt
    },
    counts: {
      incoming,
      outgoing,
      selfTransfers,
      contractInteractions,
      failed,
      tokenTransfersSeen
    },
    nativeEthFlow: {
      incoming: formatEther(nativeIncoming),
      outgoing: formatEther(nativeOutgoing),
      net: formatSignedEther(net)
    },
    counterparties: [...counterparties].slice(0, 10),
    recent,
    summary: buildNarrative({
      returned: transactions.length,
      incoming,
      outgoing,
      contractInteractions,
      failed,
      latestActivityAt,
      netEth: formatSignedEther(net)
    })
  };
}

function summarizeTokenTransfers(transfers: BlockscoutTokenTransfer[]): string[] {
  return transfers.slice(0, 5).map(transfer => {
    const symbol = transfer.token?.symbol ?? transfer.token?.name ?? "token";
    const rawValue = transfer.total?.value;
    const decimals = Number(transfer.total?.decimals ?? transfer.token?.decimals ?? 0);

    if (!rawValue || !Number.isFinite(decimals)) {
      return symbol;
    }

    return `${formatUnits(rawValue, decimals)} ${symbol}`;
  });
}

function buildNarrative(input: {
  returned: number;
  incoming: number;
  outgoing: number;
  contractInteractions: number;
  failed: number;
  latestActivityAt: string | null;
  netEth: string;
}): string {
  if (input.returned === 0) {
    return "No recent Base transactions were found for this wallet.";
  }

  const failureText = input.failed > 0 ? `, with ${input.failed} failed` : "";
  const latestText = input.latestActivityAt ? ` Latest activity was ${input.latestActivityAt}.` : "";

  return `Recent Base activity: ${input.returned} transactions, ${input.incoming} incoming, ${input.outgoing} outgoing, ${input.contractInteractions} contract interactions${failureText}; net native flow ${input.netEth} ETH.${latestText}`;
}

function formatSignedEther(value: bigint): string {
  return `${value < 0n ? "-" : ""}${formatEther(value < 0n ? -value : value)}`;
}

function formatUnits(rawValue: string, decimals: number): string {
  const negative = rawValue.startsWith("-");
  const digits = negative ? rawValue.slice(1) : rawValue;
  if (decimals === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const padded = digits.padStart(decimals + 1, "0");
  const integer = padded.slice(0, -decimals) || "0";
  const fraction = decimals > 0 ? padded.slice(-decimals).replace(/0+$/, "") : "";

  return `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function fetchWithTimeout(url: URL, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}
