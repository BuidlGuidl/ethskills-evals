import { createConfig } from "ponder";
import { http } from "viem";

import { StreakAbi } from "./abis/StreakAbi";

const CHAIN_NAMES: Record<number, string> = {
  8453: "base",
  84532: "baseSepolia",
  31337: "anvil",
};

const chainId = Number(process.env.CHAIN_ID ?? 8453);
const chainName = CHAIN_NAMES[chainId] ?? `chain${chainId}`;

/**
 * `startBlock` must be the block the Streak contract was deployed in. Ponder
 * backfills from there to the chain tip once, into Postgres, and then tails new
 * blocks -- so the feed, streaks and leaderboard cover the contract's entire
 * history, not just what happened after the process started.
 */
export default createConfig({
  database:
    process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL
      ? { kind: "postgres" }
      : { kind: "pglite" },
  chains: {
    [chainName]: {
      id: chainId,
      rpc: http(process.env.PONDER_RPC_URL),
      // A local anvil is wiped and replayed constantly; never serve it from cache.
      disableCache: chainId === 31337,
    },
  },
  contracts: {
    Streak: {
      abi: StreakAbi,
      chain: chainName,
      address: process.env.STREAK_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.STREAK_START_BLOCK ?? 0),
    },
  },
});
