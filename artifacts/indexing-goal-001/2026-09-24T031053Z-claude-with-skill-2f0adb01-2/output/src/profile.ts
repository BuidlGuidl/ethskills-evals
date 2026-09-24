import type { StreakConfig } from "./config.js";
import { query } from "./graphql.js";
import { toCheckInRow } from "./feed.js";
import { streakAbi } from "./abi.js";
import { canCheckInToday, currentMonthKey, liveStreak } from "./time.js";
import type { CheckInRow, MemberProfile } from "./types.js";

interface RawMember {
  id: string;
  totalCheckIns: number;
  currentStreak: number;
  longestStreak: number;
  firstCheckInDay: number;
  firstCheckInAt: string;
  lastCheckInDay: number;
  lastCheckInAt: string;
  checkIns: Parameters<typeof toCheckInRow>[0][];
  months: { checkIns: number }[];
}

/**
 * SCREEN 2 — a member's profile: current streak and all-time totals, plus their
 * recent check-ins.
 *
 * `Member.currentStreak` in the subgraph is the streak *as of the last check-in*.
 * It is passed through `liveStreak()` here so a lapsed streak reads as 0 — no
 * event fires when a streak dies, so the stored value cannot expire on its own.
 */
export async function getMemberProfile(
  config: StreakConfig,
  address: string,
  opts: { recentCheckIns?: number; now?: number } = {},
): Promise<MemberProfile> {
  const id = address.toLowerCase();
  const month = currentMonthKey(opts.now);
  const data = await query<{ member: RawMember | null }>(
    config,
    `query Profile($id: ID!, $first: Int!, $month: String!) {
       member(id: $id) {
         id
         totalCheckIns
         currentStreak
         longestStreak
         firstCheckInDay
         firstCheckInAt
         lastCheckInDay
         lastCheckInAt
         checkIns(first: $first, orderBy: seq, orderDirection: desc) {
           id member { id } day date note streakAfter timestamp blockNumber txHash logIndex seq
         }
         months(where: { month: $month }) { checkIns }
       }
     }`,
    { id, first: opts.recentCheckIns ?? 20, month },
  );

  const m = data.member;
  if (!m) {
    return {
      address: id as `0x${string}`,
      currentStreak: 0,
      streakAsOfLastCheckIn: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      firstCheckInDay: 0,
      firstCheckInAt: 0,
      lastCheckInDay: 0,
      lastCheckInAt: 0,
      canCheckInToday: true,
      recentCheckIns: [],
      checkInsThisMonth: 0,
      isNewMember: true,
    };
  }

  return {
    address: m.id as `0x${string}`,
    currentStreak: liveStreak(m.currentStreak, m.lastCheckInDay, opts.now),
    streakAsOfLastCheckIn: m.currentStreak,
    longestStreak: m.longestStreak,
    totalCheckIns: m.totalCheckIns,
    firstCheckInDay: m.firstCheckInDay,
    firstCheckInAt: Number(m.firstCheckInAt),
    lastCheckInDay: m.lastCheckInDay,
    lastCheckInAt: Number(m.lastCheckInAt),
    canCheckInToday: canCheckInToday(m.lastCheckInDay, opts.now),
    recentCheckIns: m.checkIns.map(toCheckInRow),
    checkInsThisMonth: m.months[0]?.checkIns ?? 0,
    isNewMember: false,
  };
}

/** A member's full check-in history, oldest first — for a calendar heatmap. */
export async function getMemberCheckInDays(
  config: StreakConfig,
  address: string,
): Promise<{ day: number; date: string; note: string }[]> {
  const id = address.toLowerCase();
  const out: { day: number; date: string; note: string }[] = [];
  let cursor = "0";
  for (;;) {
    const data = await query<{ checkIns: { day: number; date: string; note: string; seq: string }[] }>(
      config,
      `query MemberDays($id: Bytes!, $cursor: BigInt!) {
         checkIns(
           first: 1000
           orderBy: seq
           orderDirection: asc
           where: { member: $id, seq_gt: $cursor }
         ) { day date note seq }
       }`,
      { id, cursor },
    );
    if (data.checkIns.length === 0) return out;
    for (const c of data.checkIns) out.push({ day: c.day, date: c.date, note: c.note });
    cursor = data.checkIns[data.checkIns.length - 1].seq;
    if (data.checkIns.length < 1000) return out;
  }
}

/**
 * Direct-from-chain profile read. Two uses: confirming a check-in that the
 * subgraph has not ingested yet (a second or two behind the head), and as a
 * fallback if the subgraph is unavailable. It cannot produce the feed or the
 * leaderboard — those need history, which only the indexer has.
 */
export async function getMemberProfileOnchain(
  config: StreakConfig,
  address: `0x${string}`,
): Promise<Pick<MemberProfile, "address" | "currentStreak" | "longestStreak" | "totalCheckIns" | "lastCheckInDay" | "canCheckInToday">> {
  if (!config.rpcUrl || !config.contractAddress) {
    throw new Error("onchain reads need rpcUrl and contractAddress in the config");
  }
  const { createPublicClient, http } = await import("viem");
  const { base } = await import("viem/chains");
  const client = createPublicClient({ chain: base, transport: http(config.rpcUrl) });

  // One RPC round trip for all four reads.
  const contract = { address: config.contractAddress, abi: streakAbi } as const;
  const [record, live, checkedInToday] = await client.multicall({
    contracts: [
      { ...contract, functionName: "recordOf", args: [address] },
      { ...contract, functionName: "liveStreak", args: [address] },
      { ...contract, functionName: "hasCheckedInToday", args: [address] },
    ],
    allowFailure: false,
  });

  const [lastDay, , longestStreak, total] = record as readonly [number, number, number, number];
  return {
    address,
    currentStreak: Number(live),
    longestStreak: Number(longestStreak),
    totalCheckIns: Number(total),
    lastCheckInDay: Number(lastDay),
    canCheckInToday: !checkedInToday,
  };
}

export type { CheckInRow, MemberProfile };
