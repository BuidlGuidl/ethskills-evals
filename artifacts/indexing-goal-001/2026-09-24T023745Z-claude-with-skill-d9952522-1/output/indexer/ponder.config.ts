import { createConfig } from "ponder";
import { StreakAbi } from "./abis/StreakAbi";

const chainId = Number(process.env.CHAIN_ID ?? 8453); // Base mainnet
const rpc = process.env.PONDER_RPC_URL;
if (!rpc) throw new Error("PONDER_RPC_URL is required (see .env.example)");

const address = process.env.STREAK_ADDRESS as `0x${string}` | undefined;
if (!address) throw new Error("STREAK_ADDRESS is required (see .env.example)");

/**
 * `startBlock` is the block Streak was deployed in.
 *
 * This is the single most important value in this file. Ponder backfills from
 * here to the chain head before serving, then tails new blocks — so the feed,
 * streaks and leaderboard cover the contract's entire history rather than only
 * what happened after the process started. Setting it too high silently drops
 * history (streaks come out short, the leaderboard is wrong); setting it to 0
 * just wastes a long scan over empty blocks.
 */
const startBlock = Number(process.env.STREAK_START_BLOCK);
if (!Number.isInteger(startBlock)) {
  throw new Error("STREAK_START_BLOCK must be the contract's deployment block");
}

export default createConfig({
  // Postgres in production; omitting `database` uses PGlite on disk for local dev.
  database: process.env.DATABASE_URL
    ? { kind: "postgres", connectionString: process.env.DATABASE_URL }
    : { kind: "pglite" },
  chains: {
    base: {
      id: chainId,
      rpc,
      // Base produces a block every 2s; the default 1s poll is wasteful.
      pollingInterval: 2_000,
    },
  },
  contracts: {
    Streak: {
      chain: "base",
      abi: StreakAbi,
      address,
      startBlock,
    },
  },
});
