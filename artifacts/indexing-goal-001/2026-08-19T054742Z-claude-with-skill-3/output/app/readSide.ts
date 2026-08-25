/**
 * The read side for Streak's three screens.
 *
 * Everything historical -- the global feed, monthly counts, a member's note
 * history -- comes from the indexer, which holds the contract's complete
 * `CheckedIn` history in Postgres. Nothing here scans blocks or pages
 * `eth_getLogs`: that would grow with every block and fail on public RPC limits.
 *
 * The one exception is a member's *current* streak and all-time total. Those are
 * "as of now" values the contract returns on request, so the profile screen reads
 * them with a plain `eth_call` (and batches them across members with Multicall3
 * when it needs several). The indexer mirrors them too, which is what the
 * leaderboard uses, but the profile prefers the contract: it is one round trip,
 * it is trustless, and it cannot lag the chain tip.
 */
import {
  createPublicClient,
  http,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { base } from "viem/chains";

import { StreakAbi } from "./streakAbi";

export type CheckIn = {
  id: string;
  member: Address;
  note: string;
  /** Streak including this check-in, as recorded when it happened. */
  streak: number;
  /** The member's all-time total including this check-in. */
  memberTotal: number;
  /** UTC day index (unix / 86400). */
  day: number;
  /** Block timestamp, seconds. */
  timestamp: number;
  transactionHash: Hex;
  /** Opaque keyset cursor; pass the last item's back as `cursor`. */
  cursor: string;
};

export type FeedPage = { items: CheckIn[]; nextCursor: string | null };

export type Profile = {
  address: Address;
  currentStreak: number;
  totalCheckIns: number;
  longestStreak: number;
  firstCheckInAt: number | null;
  lastCheckInAt: number | null;
  checkedInToday: boolean;
  recentCheckIns: CheckIn[];
};

export type LeaderboardRow = {
  rank: number;
  member: Address;
  checkInsThisMonth: number;
  totalCheckIns: number;
  currentStreak: number;
};

export type Leaderboard = { month: string; items: LeaderboardRow[] };

export type StreakReaderConfig = {
  /** Base URL of the indexer, e.g. https://streak-indexer.up.railway.app */
  indexerUrl: string;
  /** Deployed Streak contract. */
  address: Address;
  /** RPC URL for direct contract reads. */
  rpcUrl?: string;
  chain?: Chain;
};

/** Canonical Multicall3, same address on Base and most other chains. */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

export const createStreakReader = (config: StreakReaderConfig) => {
  const base_ = config.indexerUrl.replace(/\/$/, "");
  const client = createPublicClient({
    chain: config.chain ?? base,
    transport: http(config.rpcUrl),
  });

  const get = async <T>(path: string, params: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    const url = `${base_}${path}${query.size ? `?${query}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Streak indexer ${response.status} for ${url}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  };

  return {
    /**
     * Screen 1 -- global feed, newest first, across everyone and all of history.
     * Call again with `page.nextCursor` for the next page; a null cursor is the
     * end of the record. Cursors are stable as new check-ins arrive.
     */
    getFeed: ({ limit = 25, cursor }: { limit?: number; cursor?: string | null } = {}) =>
      get<FeedPage>("/feed", { limit, cursor: cursor ?? undefined }),

    /**
     * Screen 2 -- profile. Streak and total come from the contract (live), the
     * note history from the indexer. If the contract read fails the indexer's
     * mirrored values are used, so the screen still renders.
     */
    getProfile: async (address: Address): Promise<Profile> => {
      const [indexed, onchain] = await Promise.all([
        get<Profile>(`/members/${address}`, {}),
        client
          .readContract({ abi: StreakAbi, address: config.address, functionName: "getMember", args: [address] })
          .catch(() => null),
      ]);
      if (!onchain) return indexed;
      const [currentStreak, totalCheckIns] = onchain;
      return { ...indexed, currentStreak, totalCheckIns };
    },

    /**
     * Screen 3 -- leaderboard: top members by check-ins this month. Defaults to
     * the current UTC month; pass "YYYY-MM" for any past month.
     */
    getLeaderboard: ({ month, limit = 20 }: { month?: string; limit?: number } = {}) =>
      get<Leaderboard>("/leaderboard", { month, limit }),

    /** Where a member sits on a month's leaderboard. */
    getRank: (address: Address, month?: string) =>
      get<{ month: string; address: Address; checkInsThisMonth: number; rank: number | null }>(
        `/leaderboard/${address}`,
        { month },
      ),

    /**
     * Live streak/total for many members in ONE request, via Multicall3. Use this
     * to make an already-rendered leaderboard's streak column exactly live -- not
     * to compute rankings, which are historical and belong to the indexer.
     */
    getLiveMemberStats: async (addresses: readonly Address[]) => {
      const results = await client.multicall({
        allowFailure: false,
        multicallAddress: MULTICALL3_ADDRESS,
        contracts: addresses.map((address) => ({
          abi: StreakAbi,
          address: config.address,
          functionName: "getMember" as const,
          args: [address] as const,
        })),
      });
      return addresses.map((address, i) => {
        const [currentStreak, totalCheckIns, lastDay] = results[i] as readonly [number, number, number];
        return { address, currentStreak, totalCheckIns, lastDay };
      });
    },

    /** Whether this member may check in right now (drives the button state). */
    canCheckIn: (address: Address) =>
      client.readContract({
        abi: StreakAbi,
        address: config.address,
        functionName: "canCheckIn",
        args: [address],
      }),

    /** The app's only write. Pass to a wallet client's `writeContract`. */
    buildCheckIn: (note = "") =>
      ({ abi: StreakAbi, address: config.address, functionName: "checkIn", args: [note] }) as const,

    client,
  };
};

export type StreakReader = ReturnType<typeof createStreakReader>;
