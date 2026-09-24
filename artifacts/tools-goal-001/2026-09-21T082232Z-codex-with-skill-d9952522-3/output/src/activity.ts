import { formatEther, getAddress, isAddress, isAddressEqual } from "viem";
import { z } from "zod";

const blockscoutAddressSchema = z
  .object({
    hash: z.string(),
    name: z.string().nullable().optional(),
    is_contract: z.boolean().optional(),
  })
  .passthrough();

const transactionSchema = z
  .object({
    hash: z.string(),
    timestamp: z.string().optional(),
    status: z.string().optional(),
    result: z.string().optional(),
    method: z.string().nullable().optional(),
    value: z.string().optional(),
    fee: z.object({ value: z.string().optional() }).optional(),
    from: blockscoutAddressSchema.nullable().optional(),
    to: blockscoutAddressSchema.nullable().optional(),
    transaction_types: z.array(z.string()).optional(),
  })
  .passthrough();

const blockscoutTransactionsSchema = z.object({
  items: z.array(transactionSchema),
});

export type RecentActivitySummary = Awaited<ReturnType<typeof summarizeWalletActivity>>;

export async function summarizeWalletActivity(options: {
  address: string;
  blockscoutBaseUrl: string;
  limit: number;
}) {
  if (!isAddress(options.address)) {
    throw new Error("Invalid wallet address");
  }

  const address = getAddress(options.address);
  const url = new URL(`/api/v2/addresses/${address}/transactions`, options.blockscoutBaseUrl);

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "paid-wallet-summary-api/0.1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Blockscout returned ${response.status} ${response.statusText}`);
  }

  const parsed = blockscoutTransactionsSchema.parse(await response.json());
  const transactions = parsed.items.slice(0, options.limit);

  const inbound = transactions.filter(tx => tx.to?.hash && isAddressEqualSafe(tx.to.hash, address)).length;
  const outbound = transactions.filter(tx => tx.from?.hash && isAddressEqualSafe(tx.from.hash, address)).length;
  const failed = transactions.filter(tx => tx.status && tx.status !== "ok").length;
  const contractCalls = transactions.filter(tx => tx.transaction_types?.includes("contract_call")).length;
  const valueTransfers = transactions.filter(tx => BigInt(tx.value ?? "0") > 0n).length;
  const methodCounts = countMethods(transactions.map(tx => tx.method).filter(Boolean) as string[]);

  return {
    address,
    network: "Base",
    blockExplorer: `${options.blockscoutBaseUrl.replace(/\/$/, "")}/address/${address}`,
    transactionCount: transactions.length,
    latestTimestamp: transactions[0]?.timestamp ?? null,
    summary: buildSummary({
      transactions: transactions.length,
      inbound,
      outbound,
      failed,
      contractCalls,
      valueTransfers,
      methodCounts,
      latest: transactions[0],
      address,
    }),
    recentTransactions: transactions.map(tx => ({
      hash: tx.hash,
      timestamp: tx.timestamp ?? null,
      direction: directionFor(tx, address),
      method: tx.method || "transfer",
      status: tx.status ?? tx.result ?? "unknown",
      valueEth: formatWei(tx.value),
      feeEth: formatWei(tx.fee?.value),
      from: tx.from?.hash ?? null,
      to: tx.to?.hash ?? null,
      types: tx.transaction_types ?? [],
    })),
  };
}

function buildSummary(input: {
  transactions: number;
  inbound: number;
  outbound: number;
  failed: number;
  contractCalls: number;
  valueTransfers: number;
  methodCounts: Array<[string, number]>;
  latest?: z.infer<typeof transactionSchema>;
  address: string;
}) {
  if (input.transactions === 0) {
    return `No recent Base transactions were found for ${input.address}.`;
  }

  const methods = input.methodCounts
    .slice(0, 3)
    .map(([method, count]) => `${method} (${count})`)
    .join(", ");
  const latestMethod = input.latest?.method || "transfer";
  const latestStatus = input.latest?.status ?? input.latest?.result ?? "unknown";

  return [
    `Latest ${input.transactions} Base transactions: ${input.outbound} outbound and ${input.inbound} inbound.`,
    `${input.contractCalls} contract calls, ${input.valueTransfers} value transfers, ${input.failed} failed transactions.`,
    methods ? `Most common methods: ${methods}.` : "No decoded contract methods were present.",
    `Most recent activity was ${latestMethod} with status ${latestStatus}.`,
  ].join(" ");
}

function countMethods(methods: string[]) {
  const counts = new Map<string, number>();
  for (const method of methods) {
    counts.set(method, (counts.get(method) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function directionFor(tx: z.infer<typeof transactionSchema>, address: string) {
  const from = tx.from?.hash;
  const to = tx.to?.hash;

  if (from && isAddressEqualSafe(from, address)) return "outbound";
  if (to && isAddressEqualSafe(to, address)) return "inbound";
  return "related";
}

function isAddressEqualSafe(a: string, b: string) {
  return isAddress(a) && isAddress(b) && isAddressEqual(a, b);
}

function formatWei(value?: string) {
  if (!value) return "0";
  try {
    const formatted = formatEther(BigInt(value));
    return trimDecimal(formatted);
  } catch {
    return "0";
  }
}

function trimDecimal(value: string) {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

