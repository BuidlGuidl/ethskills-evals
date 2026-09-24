import { createConfig } from "ponder";

import { StreakAbi } from "./abis/StreakAbi";

const address = process.env.STREAK_ADDRESS;
if (!address) throw new Error("STREAK_ADDRESS is not set (see .env.example)");

const rpc = process.env.PONDER_RPC_URL;
if (!rpc) throw new Error("PONDER_RPC_URL is not set (see .env.example)");

export default createConfig({
  chains: {
    // Key stays "base" in every environment; CHAIN_ID switches between Base
    // mainnet (8453), Base Sepolia (84532) and a local anvil (31337).
    base: {
      id: Number(process.env.CHAIN_ID ?? 8453),
      rpc,
    },
  },
  contracts: {
    Streak: {
      chain: "base",
      abi: StreakAbi,
      address: address as `0x${string}`,
      // The deployment block. Indexing starts here and replays every historical
      // log before the API reports itself ready, so the feed, streaks and
      // leaderboard cover the contract's whole life, not just live events.
      startBlock: Number(process.env.STREAK_START_BLOCK ?? 0),
    },
  },
});
