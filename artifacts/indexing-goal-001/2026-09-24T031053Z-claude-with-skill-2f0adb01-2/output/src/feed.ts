import type { StreakConfig } from "./config.js";
import { query } from "./graphql.js";
import type { CheckInRow } from "./types.js";
import { streakAbi } from "./abi.js";

const CHECK_IN_FIELDS = `
  id
  member { id }
  day
  date
  note
  streakAfter
  timestamp
  blockNumber
  txHash
  logIndex
  seq
`;

interface RawCheckIn {
  id: string;
  member: { id: string };
  day: number;
  date: string;
  note: string;
  streakAfter: number;
  timestamp: string;
  blockNumber: string;
  txHash: string;
  logIndex: string;
  seq: string;
}

export function toCheckInRow(raw: RawCheckIn): CheckInRow {
  return {
    id: raw.id,
    member: raw.member.id as `0x${string}`,
    day: raw.day,
    date: raw.date,
    note: raw.note,
    streakAfter: raw.streakAfter,
    timestamp: Number(raw.timestamp),
    blockNumber: Number(raw.blockNumber),
    txHash: raw.txHash as `0x${string}`,
    logIndex: Number(raw.logIndex),
    seq: raw.seq,
  };
}

/** Stable key for a feed row; use it to dedupe subgraph rows against live ones. */
export function feedRowKey(row: Pick<CheckInRow, "txHash" | "logIndex">): string {
  return `${row.txHash.toLowerCase()}-${row.logIndex}`;
}

export interface FeedPage {
  checkIns: CheckInRow[];
  /** Pass as `cursor` to fetch the next (older) page; null when exhausted. */
  nextCursor: string | null;
}

/**
 * SCREEN 1 — the global feed, newest first, over the contract's entire history.
 *
 * Pages with a `seq_lt` keyset cursor rather than `skip`, because graph-node
 * rejects `skip` above 5000 and the contract will have months of check-ins
 * behind it on launch day.
 */
export async function getGlobalFeed(
  config: StreakConfig,
  opts: { first?: number; cursor?: string | null } = {},
): Promise<FeedPage> {
  const first = Math.min(opts.first ?? 50, 1000);
  const data = await query<{ checkIns: RawCheckIn[] }>(
    config,
    `query GlobalFeed($first: Int!, $cursor: BigInt!) {
       checkIns(
         first: $first
         orderBy: seq
         orderDirection: desc
         where: { seq_lt: $cursor }
       ) { ${CHECK_IN_FIELDS} }
     }`,
    {
      first,
      // A cursor above any possible blockNumber * 100000 + logIndex.
      cursor: opts.cursor ?? "99999999999999999999",
    },
  );

  const checkIns = data.checkIns.map(toCheckInRow);
  return {
    checkIns,
    nextCursor: checkIns.length === first ? checkIns[checkIns.length - 1].seq : null,
  };
}

/** Walk the whole feed, oldest page last. Use for exports and backfills. */
export async function* iterateGlobalFeed(
  config: StreakConfig,
  pageSize = 500,
): AsyncGenerator<CheckInRow[]> {
  let cursor: string | null = null;
  for (;;) {
    const page = await getGlobalFeed(config, { first: pageSize, cursor });
    if (page.checkIns.length > 0) yield page.checkIns;
    if (!page.nextCursor) return;
    cursor = page.nextCursor;
  }
}

/** Check-ins for one UTC calendar date ("YYYY-MM-DD"), newest first. */
export async function getFeedForDate(
  config: StreakConfig,
  date: string,
  first = 200,
): Promise<CheckInRow[]> {
  const data = await query<{ checkIns: RawCheckIn[] }>(
    config,
    `query FeedForDate($date: String!, $first: Int!) {
       checkIns(first: $first, orderBy: seq, orderDirection: desc, where: { date: $date }) {
         ${CHECK_IN_FIELDS}
       }
     }`,
    { date, first },
  );
  return data.checkIns.map(toCheckInRow);
}

/**
 * Optional live tail for the feed.
 *
 * The subgraph already follows the chain head within a block or two, so polling
 * `getGlobalFeed` is enough for most UIs. This exists for instant-feel appends:
 * it watches only *new* logs via RPC and never backfills — history comes from the
 * subgraph. Dedupe with {@link feedRowKey}.
 *
 * Requires `viem` plus `rpcUrl` and `contractAddress` in the config.
 */
export async function watchNewCheckIns(
  config: StreakConfig,
  onCheckIn: (row: Omit<CheckInRow, "id" | "date" | "seq">) => void,
): Promise<() => void> {
  if (!config.rpcUrl || !config.contractAddress) {
    throw new Error("watchNewCheckIns needs rpcUrl and contractAddress in the config");
  }
  const { createPublicClient, http, webSocket } = await import("viem");
  const { base } = await import("viem/chains");

  const client = createPublicClient({
    chain: base,
    transport: config.rpcUrl.startsWith("ws") ? webSocket(config.rpcUrl) : http(config.rpcUrl),
  });

  return client.watchContractEvent({
    address: config.contractAddress,
    abi: streakAbi,
    eventName: "CheckedIn",
    onLogs: (logs) => {
      for (const log of logs) {
        const args = log.args as {
          member: `0x${string}`;
          day: number;
          timestamp: bigint;
          streak: number;
          total: number;
          note: string;
        };
        onCheckIn({
          member: args.member,
          day: Number(args.day),
          note: args.note,
          streakAfter: Number(args.streak),
          timestamp: Number(args.timestamp),
          blockNumber: Number(log.blockNumber),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
        });
      }
    },
  });
}
