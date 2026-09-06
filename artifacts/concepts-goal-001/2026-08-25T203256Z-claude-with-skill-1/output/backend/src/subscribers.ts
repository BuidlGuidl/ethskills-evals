import { createPublicClient, http, formatUnits, type Address, type Chain } from "viem";
import { subscriptionBillingAbi } from "./abi.js";

/**
 * Finding out who your subscribers are.
 *
 * The contract knows what any given address owes, but it does not keep a list — storing and
 * iterating one onchain would cost gas on every signup for the benefit of an offchain caller.
 * The list lives in the event log instead, which is what event logs are for: cheap to write,
 * free to read, and reconstructible by anyone from the chain alone.
 *
 * That last part matters. This is not a private database you have to back up. If you lose this
 * machine, or someone else wants to audit your revenue, the same scan reproduces the same
 * answer from public data.
 */

export interface ScanConfig {
  contract: Address;
  chain: Chain;
  rpcUrl: string;
  /** Block the contract was deployed in. Scanning from 0 works but wastes a lot of requests. */
  fromBlock: bigint;
  /** Blocks per getLogs request. Lower it if your RPC provider complains. Default 50k. */
  chunkSize?: bigint;
}

export interface SubscriberRow {
  address: Address;
  planId: number;
  activeUntil: number;
  /** Token units owed to you right now but not yet booked into `revenue`. */
  accrued: bigint;
}

/** Every address that has ever subscribed. Cancelled accounts stay in the list — they may still
 *  hold an unsettled balance you have earned. */
export async function findEverSubscribed(cfg: ScanConfig): Promise<Address[]> {
  const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });
  const chunk = cfg.chunkSize ?? 50_000n;
  const latest = await client.getBlockNumber();
  const seen = new Set<Address>();

  for (let from = cfg.fromBlock; from <= latest; from += chunk) {
    const to = from + chunk - 1n > latest ? latest : from + chunk - 1n;
    const logs = await client.getContractEvents({
      address: cfg.contract,
      abi: subscriptionBillingAbi,
      eventName: "Subscribed",
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) {
      const account = log.args.account;
      if (account) seen.add(account);
    }
  }
  return [...seen];
}

/**
 * Who is worth settling right now, most valuable first.
 *
 * Settling an account with nothing accrued is legal and pointless — it burns gas to write the
 * same number back. This filters those out, so `settleAndCollect` only pays for accounts that
 * actually move money.
 */
export async function collectableSubscribers(
  cfg: ScanConfig,
  opts: { minAccrued?: bigint; limit?: number } = {},
): Promise<SubscriberRow[]> {
  const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });
  const addresses = await findEverSubscribed(cfg);
  if (addresses.length === 0) return [];

  const [statuses, accrued] = await Promise.all([
    client.readContract({
      address: cfg.contract,
      abi: subscriptionBillingAbi,
      functionName: "statusOfMany",
      args: [addresses],
    }),
    client.multicall({
      contracts: addresses.map((a) => ({
        address: cfg.contract,
        abi: subscriptionBillingAbi,
        functionName: "accrued" as const,
        args: [a] as const,
      })),
      allowFailure: false,
    }),
  ]);

  const min = opts.minAccrued ?? 1n;
  const rows: SubscriberRow[] = addresses
    .map((address, i) => ({
      address,
      planId: Number(statuses[i].planId),
      activeUntil: Number(statuses[i].activeUntil),
      accrued: accrued[i] as bigint,
    }))
    .filter((r) => r.accrued >= min)
    .sort((a, b) => (b.accrued > a.accrued ? 1 : b.accrued < a.accrued ? -1 : 0));

  // The contract caps a settle batch at 500 accounts; keep some headroom for block gas limits.
  return rows.slice(0, opts.limit ?? 400);
}

/**
 * Who lapses soon.
 *
 * A subscription ends by running out of money, silently, with no transaction and therefore no
 * notification. Nobody tells your customer — the contract cannot, and you are the only party
 * who knows their email. Reading `activeUntil` ahead of time is the whole retention story.
 */
export async function lapsingSoon(cfg: ScanConfig, withinSeconds = 7 * 86400): Promise<SubscriberRow[]> {
  const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });
  const addresses = await findEverSubscribed(cfg);
  if (addresses.length === 0) return [];

  const statuses = await client.readContract({
    address: cfg.contract,
    abi: subscriptionBillingAbi,
    functionName: "statusOfMany",
    args: [addresses],
  });

  const now = Math.floor(Date.now() / 1000);
  return addresses
    .map((address, i) => ({
      address,
      planId: Number(statuses[i].planId),
      activeUntil: Number(statuses[i].activeUntil),
      accrued: 0n,
    }))
    .filter((r) => r.activeUntil > now && r.activeUntil <= now + withinSeconds)
    .sort((a, b) => a.activeUntil - b.activeUntil);
}

export function formatUsdc(units: bigint): string {
  return `$${formatUnits(units, 6)}`;
}
