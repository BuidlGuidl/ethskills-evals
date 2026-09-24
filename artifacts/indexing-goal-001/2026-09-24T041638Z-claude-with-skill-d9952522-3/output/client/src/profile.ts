import { createPublicClient, http, type Address, type Chain } from "viem";
import { base } from "viem/chains";
import { StreakAbi } from "../../indexer/abis/StreakAbi";

/**
 * Live profile numbers, read straight from the contract.
 *
 * Current streak and all-time total are "as of now" values the chain returns on
 * request, so the profile screen does not need the indexer for them — and a
 * streak that broke this morning is correct here the instant it breaks, with no
 * event to index. Use the indexer for the member's note history and for
 * anything that requires aggregating across members.
 *
 * Multiple addresses (e.g. decorating a leaderboard page) go out as one
 * Multicall3 request rather than N eth_calls.
 */

export interface LiveProfile {
  member: Address;
  currentStreak: number;
  longestStreak: number;
  total: number;
  firstDay: number;
  lastDay: number;
  checkedInToday: boolean;
}

export interface StreakClientOptions {
  /** Defaults to Base mainnet. */
  chain?: Chain;
  /**
   * Coalesce concurrent eth_calls into one Multicall3 request. On by default:
   * Base has Multicall3 at 0xcA11bde05977b3631167028862bE2a173976CA11, already
   * wired into viem's chain config. Turn it off against a bare `anvil`, which
   * does not predeploy Multicall3 — every call there would decode as 0x.
   */
  batchMulticall?: boolean;
}

export function createStreakClient(rpcUrl: string, options: StreakClientOptions = {}) {
  const { chain = base, batchMulticall = true } = options;
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
    batch: batchMulticall ? { multicall: true } : undefined,
  });
}

/** The client `createStreakClient` returns; also accepts wagmi's public client. */
export type StreakPublicClient = ReturnType<typeof createStreakClient>;

function decode(member: Address, result: readonly [number, number, number, number, number, boolean]): LiveProfile {
  const [currentStreak, longestStreak, total, firstDay, lastDay, checkedInToday] = result;
  return { member, currentStreak, longestStreak, total, firstDay, lastDay, checkedInToday };
}

export async function getLiveProfile(
  client: StreakPublicClient,
  contract: Address,
  member: Address,
): Promise<LiveProfile> {
  const result = await client.readContract({
    address: contract,
    abi: StreakAbi,
    functionName: "profileOf",
    args: [member],
  });
  return decode(member, result);
}

/**
 * One Multicall3 request for many members — e.g. decorating a leaderboard page
 * with live streaks. Requires Multicall3 on the chain (Base has it).
 */
export async function getLiveProfiles(
  client: StreakPublicClient,
  contract: Address,
  members: readonly Address[],
): Promise<LiveProfile[]> {
  if (members.length === 0) return [];
  const results = await client.multicall({
    allowFailure: false,
    contracts: members.map((member) => ({
      address: contract,
      abi: StreakAbi,
      functionName: "profileOf",
      args: [member],
    })),
  });
  return results.map((result, i) => decode(members[i]!, result as never));
}

/** Whether to show the "check in" button as available. */
export async function canCheckInToday(
  client: StreakPublicClient,
  contract: Address,
  member: Address,
): Promise<boolean> {
  const checkedIn = await client.readContract({
    address: contract,
    abi: StreakAbi,
    functionName: "hasCheckedInToday",
    args: [member],
  });
  return !checkedIn;
}
