import { createConfig } from "ponder";

import { StreakAbi } from "./abis/StreakAbi";

/**
 * The indexer backfills every `CheckedIn` event from the block the Streak
 * contract was deployed in, then tails the chain for new ones. `startBlock`
 * must be the deployment block: anything later silently truncates history, and
 * block 0 makes the backfill crawl millions of empty Base blocks.
 *
 * CHAIN_ID defaults to Base mainnet; set it to 31337 to run the whole stack
 * against a local anvil node (see scripts/seed-local.sh).
 */
const chainId = Number(process.env.CHAIN_ID ?? 8453);
const isLocalChain = chainId === 31337;

export default createConfig({
  chains: {
    base: {
      id: chainId,
      rpc: process.env.PONDER_RPC_URL_BASE!,
      // Base produces a block every 2s.
      pollingInterval: isLocalChain ? 500 : 2_000,
      // A local node gets reset constantly; never reuse a cached response.
      disableCache: isLocalChain,
    },
  },
  contracts: {
    Streak: {
      chain: "base",
      abi: StreakAbi,
      address: process.env.STREAK_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.STREAK_START_BLOCK ?? 0),
    },
  },
});
