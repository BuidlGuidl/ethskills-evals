import { createConfig } from "ponder";
import { streakAbi } from "./abis/streakAbi";

const chainId = Number(process.env.CHAIN_ID ?? 8453); // Base mainnet
const rpc = process.env.PONDER_RPC_URL ?? "https://mainnet.base.org";

const address = process.env.STREAK_ADDRESS as `0x${string}` | undefined;
if (!address) {
  throw new Error(
    "STREAK_ADDRESS is not set. Copy .env.example to .env.local and fill in the deployed contract address.",
  );
}

/**
 * `startBlock` is the block the contract was deployed in. Ponder backfills from
 * there to the chain tip before serving traffic, then follows new blocks live —
 * which is what makes the feed, streaks and leaderboard cover the contract's
 * entire history rather than only what happened while the app was open.
 */
const startBlock = Number(process.env.STREAK_START_BLOCK ?? 0);

export default createConfig({
  chains: {
    base: {
      id: chainId,
      rpc,
      // Public RPCs cap eth_getLogs ranges; a paid endpoint can go much wider
      // and will backfill months of history in a fraction of the time.
      ethGetLogsBlockRange: Number(process.env.PONDER_LOGS_BLOCK_RANGE ?? 1_000),
    },
  },
  contracts: {
    Streak: {
      chain: "base",
      abi: streakAbi,
      address,
      startBlock,
    },
  },
});
