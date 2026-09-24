import { createConfig } from "ponder";

import { StreakAbi } from "./abis/StreakAbi";

const chainId = Number(process.env.CHAIN_ID ?? 8453);

if (!process.env.STREAK_ADDRESS) {
  throw new Error("STREAK_ADDRESS is required (see .env.example)");
}
if (!process.env.STREAK_START_BLOCK) {
  throw new Error(
    "STREAK_START_BLOCK is required — set it to the block the Streak contract was deployed in, so the backfill covers the entire history",
  );
}

export default createConfig({
  chains: {
    base: {
      id: chainId,
      rpc: process.env.PONDER_RPC_URL_BASE!,
      // Raise if your RPC provider allows wider `eth_getLogs` ranges; this is
      // only used during the historical backfill.
      maxRequestsPerSecond: Number(process.env.RPC_MAX_RPS ?? 25),
    },
  },
  contracts: {
    Streak: {
      chain: "base",
      abi: StreakAbi,
      address: process.env.STREAK_ADDRESS as `0x${string}`,
      // The deployment block. Ponder backfills from here to the chain tip before
      // serving, then follows realtime blocks — so every query is answered from
      // the complete history, not from "whatever happened since the app opened".
      startBlock: Number(process.env.STREAK_START_BLOCK),
    },
  },
});
