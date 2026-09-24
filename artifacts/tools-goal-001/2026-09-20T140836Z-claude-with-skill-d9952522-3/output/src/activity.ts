/**
 * Wallet activity summary, read from Blockscout's indexed REST API.
 *
 * Blockscout also ships an MCP server (https://mcp.blockscout.com/mcp) which is
 * the better door when an agent consumes the data directly. Here the consumer is
 * this server, so we use the REST API and shape the summary ourselves.
 */

const BLOCKSCOUT_BY_NETWORK: Record<string, string> = {
  "eip155:8453": "https://base.blockscout.com/api/v2",
  "eip155:84532": "https://base-sepolia.blockscout.com/api/v2",
};

export type ActivitySummary = {
  address: string;
  network: string;
  summary: string;
  window: { transactions: number; from?: string; to?: string };
  counts: { sent: number; received: number; contractCalls: number };
  topCounterparties: { address: string; interactions: number }[];
  balances: { native: string; topTokens: { symbol: string; amount: string }[] };
};

type BlockscoutTx = {
  hash: string;
  timestamp: string | null;
  from: { hash: string } | null;
  to: { hash: string; is_contract?: boolean; name?: string | null } | null;
  method: string | null;
  result: string;
};

type BlockscoutAddress = {
  coin_balance: string | null;
};

type BlockscoutTokenBalance = {
  value: string | null;
  // Null for entries Blockscout can't resolve (unverified tokens, NFTs).
  token: { symbol: string | null; decimals: string | null } | null;
};

const MAX_TXS = 25;

export function blockscoutBaseUrl(network: string): string {
  const url = BLOCKSCOUT_BY_NETWORK[network];
  if (!url) {
    throw new Error(
      `No Blockscout instance configured for ${network}. Add one to BLOCKSCOUT_BY_NETWORK.`,
    );
  }
  return url;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Blockscout ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

function formatUnits(raw: string, decimals: number, precision = 4): string {
  const negative = raw.startsWith("-");
  const digits = (negative ? raw.slice(1) : raw).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).slice(0, precision).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/**
 * Fetches and summarizes a wallet's recent on-chain activity.
 *
 * @param address - The wallet address to summarize
 * @param network - CAIP-2 network id, e.g. "eip155:8453"
 * @returns A compact summary suitable for an agent to read
 */
export async function summarizeWalletActivity(
  address: string,
  network: string,
): Promise<ActivitySummary> {
  const api = blockscoutBaseUrl(network);
  const lower = address.toLowerCase();

  const [txPage, addressInfo, tokenBalances] = await Promise.all([
    getJson<{ items: BlockscoutTx[] }>(`${api}/addresses/${address}/transactions`),
    getJson<BlockscoutAddress>(`${api}/addresses/${address}`),
    getJson<BlockscoutTokenBalance[]>(`${api}/addresses/${address}/token-balances`).catch(() => []),
  ]);

  const txs = (txPage.items ?? []).slice(0, MAX_TXS);

  let sent = 0;
  let received = 0;
  let contractCalls = 0;
  const counterparties = new Map<string, number>();

  for (const tx of txs) {
    const from = tx.from?.hash?.toLowerCase();
    const to = tx.to?.hash?.toLowerCase();
    if (from === lower) sent++;
    if (to === lower) received++;
    if (from === lower && tx.to?.is_contract) contractCalls++;

    const other = from === lower ? to : from;
    if (other && other !== lower) {
      counterparties.set(other, (counterparties.get(other) ?? 0) + 1);
    }
  }

  const topCounterparties = [...counterparties.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([addr, interactions]) => ({ address: addr, interactions }));

  const topTokens = tokenBalances
    .filter((b) => b.token?.decimals && b.value)
    .map((b) => {
      const decimals = Number(b.token!.decimals);
      return {
        symbol: b.token!.symbol ?? "?",
        amount: formatUnits(b.value!, decimals),
        sortKey: Number(b.value) / 10 ** decimals,
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 5)
    .map(({ symbol, amount }) => ({ symbol, amount }));

  const native = formatUnits(addressInfo.coin_balance ?? "0", 18);
  const newest = txs[0]?.timestamp ?? undefined;
  const oldest = txs[txs.length - 1]?.timestamp ?? undefined;

  const summary = txs.length
    ? `${address} has ${txs.length} recent transactions (${sent} outgoing, ${received} incoming, ` +
      `${contractCalls} contract calls) between ${oldest?.slice(0, 10)} and ${newest?.slice(0, 10)}. ` +
      `Holds ${native} ETH` +
      (topTokens.length ? ` and ${topTokens.map((t) => `${t.amount} ${t.symbol}`).join(", ")}` : "") +
      `. Most frequent counterparty: ${topCounterparties[0]?.address ?? "none"}.`
    : `${address} has no transactions indexed on ${network}. Holds ${native} ETH.`;

  return {
    address,
    network,
    summary,
    window: { transactions: txs.length, from: oldest, to: newest },
    counts: { sent, received, contractCalls },
    topCounterparties,
    balances: { native, topTokens },
  };
}
