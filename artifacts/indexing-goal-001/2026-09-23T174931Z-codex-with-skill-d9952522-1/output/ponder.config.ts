import { createConfig } from "ponder";
import { StreakCheckInAbi } from "./abis/StreakCheckIn";

const contractAddress = process.env.STREAK_CONTRACT_ADDRESS as `0x${string}` | undefined;
const startBlock = Number(process.env.PONDER_START_BLOCK ?? "0");

if (contractAddress === undefined) {
  throw new Error("STREAK_CONTRACT_ADDRESS is required");
}

if (!Number.isInteger(startBlock) || startBlock < 0) {
  throw new Error("PONDER_START_BLOCK must be a non-negative integer");
}

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453 ?? process.env.BASE_RPC_URL,
    },
  },
  contracts: {
    StreakCheckIn: {
      abi: StreakCheckInAbi,
      chain: "base",
      address: contractAddress,
      startBlock,
    },
  },
});
