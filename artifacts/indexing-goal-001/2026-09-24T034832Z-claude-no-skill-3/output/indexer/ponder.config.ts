import { createConfig } from "ponder";
import { StreakAbi } from "./abis/StreakAbi";

/** Chains the app knows how to index. `anvil` is for local development. */
const CHAIN_IDS = {
  base: 8453,
  baseSepolia: 84532,
  anvil: 31337,
} as const;

type ChainName = keyof typeof CHAIN_IDS;

const chain = (process.env.STREAK_CHAIN ?? "base") as ChainName;
if (!(chain in CHAIN_IDS)) {
  throw new Error(`STREAK_CHAIN must be one of ${Object.keys(CHAIN_IDS).join(", ")}, got "${chain}"`);
}

const address = process.env.STREAK_ADDRESS;
if (!address) throw new Error("STREAK_ADDRESS is required (see .env.example)");

// The block the Streak contract was deployed in. Backfill starts here, so the
// indexed history is complete: every check-in ever made, not just new ones.
const startBlock = Number(process.env.STREAK_START_BLOCK ?? 0);
if (!Number.isInteger(startBlock) || startBlock < 0) {
  throw new Error(`STREAK_START_BLOCK must be a non-negative integer, got "${process.env.STREAK_START_BLOCK}"`);
}

export default createConfig({
  chains: {
    [chain]: {
      id: CHAIN_IDS[chain],
      rpc: process.env.PONDER_RPC_URL,
      // Anvil is wiped between runs, so cached RPC responses would be stale.
      disableCache: chain === "anvil",
    },
  },
  contracts: {
    Streak: {
      abi: StreakAbi,
      chain,
      address: address as `0x${string}`,
      startBlock,
    },
  },
});
