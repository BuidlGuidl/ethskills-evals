import { createConfig } from "ponder";

import { StreakAbi } from "./abis/Streak";

const zeroAddress = "0x0000000000000000000000000000000000000000";

const rpcUrl =
  process.env.PONDER_RPC_URL_8453 ?? process.env.BASE_RPC_URL ?? "http://127.0.0.1:8545";

export default createConfig({
  chains: {
    base: {
      id: Number(process.env.PONDER_CHAIN_ID ?? 8453),
      rpc: rpcUrl,
      disableCache: process.env.PONDER_DISABLE_CACHE === "true",
    },
  },
  contracts: {
    Streak: {
      abi: StreakAbi,
      chain: "base",
      address: (process.env.STREAK_CONTRACT_ADDRESS ?? zeroAddress) as `0x${string}`,
      startBlock: Number(process.env.STREAK_START_BLOCK ?? 0),
    },
  },
});
