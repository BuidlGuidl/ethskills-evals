import { createConfig } from "ponder";
import { StreakAbi } from "./abis/StreakAbi.js";

const address = process.env.STREAK_ADDRESS;
if (!address || /^0x0{40}$/i.test(address)) {
  throw new Error("Set STREAK_ADDRESS to the deployed Streak contract address.");
}

const startBlock = Number(process.env.START_BLOCK);
if (!Number.isSafeInteger(startBlock) || startBlock < 1) {
  throw new Error("Set START_BLOCK to the Streak deployment block on Base.");
}

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL,
    },
  },
  contracts: {
    Streak: {
      abi: StreakAbi,
      address: address as `0x${string}`,
      chain: "base",
      startBlock,
    },
  },
});
