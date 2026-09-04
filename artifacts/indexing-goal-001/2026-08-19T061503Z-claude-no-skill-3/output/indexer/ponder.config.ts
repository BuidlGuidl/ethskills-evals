import { createConfig } from "ponder";
import { StreakAbi } from "./abis/StreakAbi.ts";

/**
 * The indexer backfills every `CheckedIn` event from the contract's deployment
 * block up to the chain head, then stays subscribed for new ones. That backfill
 * is why the feed, streaks and leaderboard can show the full history rather than
 * only what happens after a page is opened.
 *
 * `STREAK_START_BLOCK` must be the deployment block (printed by the deploy
 * script). Setting it later than the deployment silently truncates history;
 * setting it to 0 just makes the backfill slower.
 */
const chainId = Number(process.env.CHAIN_ID ?? 8453);

export default createConfig({
  chains: {
    base: {
      id: chainId,
      rpc: process.env.PONDER_RPC_URL_BASE ?? "https://mainnet.base.org",
      // Local anvil mines instantly; on Base a 2s poll matches the block time.
      pollingInterval: chainId === 31337 ? 200 : 2_000,
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
