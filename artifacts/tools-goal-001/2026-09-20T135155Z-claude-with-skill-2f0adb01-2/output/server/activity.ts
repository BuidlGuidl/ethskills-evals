/**
 * Wallet activity summaries via the Blockscout v2 REST API.
 *
 * Blockscout is used instead of a raw RPC because it already indexes the
 * decoded method names and token transfers that make a summary readable,
 * and it needs no API key.
 */

const TX_LIMIT = 25;

type BlockscoutAddressRef = {
  hash: string;
  name?: string | null;
  ens_domain_name?: string | null;
  is_contract?: boolean;
};

type BlockscoutTx = {
  hash: string;
  timestamp?: string | null;
  value?: string | null;
  result?: string | null;
  status?: string | null;
  method?: string | null;
  from?: BlockscoutAddressRef | null;
  to?: BlockscoutAddressRef | null;
};

type BlockscoutTokenTransfer = {
  timestamp?: string | null;
  total?: { value?: string | null; decimals?: string | number | null } | null;
  token?: { symbol?: string | null; decimals?: string | null } | null;
  from?: BlockscoutAddressRef | null;
  to?: BlockscoutAddressRef | null;
};

export type ActivitySummary = {
  address: string;
  chain: string;
  summary: string;
  stats: {
    transactionsScanned: number;
    outgoing: number;
    incoming: number;
    failed: number;
    nativeSentEth: string;
    firstSeen: string | null;
    lastSeen: string | null;
  };
  topCounterparties: { address: string; label: string | null; interactions: number }[];
  topMethods: { method: string; count: number }[];
  recentTokenTransfers: { token: string; amount: string; direction: "in" | "out"; timestamp: string | null }[];
};

export class UpstreamError extends Error {}

async function blockscout<T>(baseUrl: string, path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${baseUrl}/api/v2${path}`, {
    headers: { accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    throw new UpstreamError(`Blockscout ${path} responded ${res.status}`);
  }
  return (await res.json()) as T;
}

function label(ref: BlockscoutAddressRef | null | undefined): string | null {
  if (!ref) return null;
  return ref.ens_domain_name ?? ref.name ?? null;
}

function formatUnits(raw: string, decimals: number): string {
  const negative = raw.startsWith("-");
  const digits = (negative ? raw.slice(1) : raw).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = decimals === 0 ? "" : digits.slice(digits.length - decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function topN<T>(counts: Map<string, { count: number; extra: T }>, n: number) {
  return [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, n);
}

/**
 * Builds a short, agent-consumable summary of a wallet's recent activity.
 *
 * @param address - The wallet to summarize (checksummed or lowercase)
 * @param opts - Blockscout instance for the target chain plus a display name
 */
export async function summarizeWallet(
  address: string,
  opts: { blockscoutUrl: string; chain: string; timeoutMs?: number },
): Promise<ActivitySummary> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);

  try {
    const [txPage, transferPage] = await Promise.all([
      blockscout<{ items?: BlockscoutTx[] }>(
        opts.blockscoutUrl,
        `/addresses/${address}/transactions`,
        controller.signal,
      ),
      blockscout<{ items?: BlockscoutTokenTransfer[] }>(
        opts.blockscoutUrl,
        `/addresses/${address}/token-transfers`,
        controller.signal,
      ).catch(() => ({ items: [] as BlockscoutTokenTransfer[] })),
    ]);

    const txs = (txPage.items ?? []).slice(0, TX_LIMIT);
    const target = address.toLowerCase();

    let outgoing = 0;
    let incoming = 0;
    let failed = 0;
    let nativeSentWei = 0n;
    const counterparties = new Map<string, { count: number; extra: string | null }>();
    const methods = new Map<string, { count: number; extra: null }>();

    for (const tx of txs) {
      const isOutgoing = tx.from?.hash?.toLowerCase() === target;
      if (isOutgoing) {
        outgoing++;
        nativeSentWei += BigInt(tx.value ?? "0");
      } else {
        incoming++;
      }
      if (tx.result && tx.result !== "success") failed++;

      const other = isOutgoing ? tx.to : tx.from;
      if (other?.hash) {
        const key = other.hash;
        const entry = counterparties.get(key) ?? { count: 0, extra: label(other) };
        entry.count++;
        counterparties.set(key, entry);
      }

      const method = tx.method ?? (tx.to?.is_contract ? "contract call" : "transfer");
      const methodEntry = methods.get(method) ?? { count: 0, extra: null };
      methodEntry.count++;
      methods.set(method, methodEntry);
    }

    const timestamps = txs.map(tx => tx.timestamp).filter((t): t is string => Boolean(t)).sort();
    const lastSeen = timestamps.at(-1) ?? null;
    const firstSeen = timestamps.at(0) ?? null;

    const recentTokenTransfers = (transferPage.items ?? []).slice(0, 5).map(transfer => {
      const decimals = Number(transfer.token?.decimals ?? transfer.total?.decimals ?? 18);
      const raw = transfer.total?.value ?? "0";
      return {
        token: transfer.token?.symbol ?? "unknown",
        amount: formatUnits(raw, Number.isFinite(decimals) ? decimals : 18),
        direction: (transfer.from?.hash?.toLowerCase() === target ? "out" : "in") as "in" | "out",
        timestamp: transfer.timestamp ?? null,
      };
    });

    const topMethods = topN(methods, 3).map(([method, v]) => ({ method, count: v.count }));
    const topCounterparties = topN(counterparties, 3).map(([addr, v]) => ({
      address: addr,
      label: v.extra,
      interactions: v.count,
    }));

    const summary =
      txs.length === 0
        ? `No transactions found for ${address} on ${opts.chain}.`
        : [
            `${address} has ${txs.length} recent transaction${txs.length === 1 ? "" : "s"} on ${opts.chain}`,
            `(${outgoing} outgoing, ${incoming} incoming${failed ? `, ${failed} failed` : ""}).`,
            `Sent ${formatUnits(nativeSentWei.toString(), 18)} ETH across those.`,
            topMethods.length
              ? `Most common actions: ${topMethods.map(m => `${m.method} (${m.count})`).join(", ")}.`
              : "",
            topCounterparties.length
              ? `Top counterparties: ${topCounterparties
                  .map(c => `${c.label ?? c.address} (${c.interactions})`)
                  .join(", ")}.`
              : "",
            recentTokenTransfers.length
              ? `Recent token flow: ${recentTokenTransfers
                  .map(t => `${t.direction === "out" ? "-" : "+"}${t.amount} ${t.token}`)
                  .join(", ")}.`
              : "",
            lastSeen ? `Last active ${lastSeen}.` : "",
          ]
            .filter(Boolean)
            .join(" ");

    return {
      address,
      chain: opts.chain,
      summary,
      stats: {
        transactionsScanned: txs.length,
        outgoing,
        incoming,
        failed,
        nativeSentEth: formatUnits(nativeSentWei.toString(), 18),
        firstSeen,
        lastSeen,
      },
      topCounterparties,
      topMethods,
      recentTokenTransfers,
    };
  } finally {
    clearTimeout(timer);
  }
}
