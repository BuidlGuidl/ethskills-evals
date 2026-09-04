import { createConfig } from "ponder";
import { streakAbi } from "./abis/streakAbi";

const chainId = Number(process.env.CHAIN_ID ?? 8453);

export default createConfig({
  chains: {
    // Named for the production target. CHAIN_ID + PONDER_RPC_URL repoint the same
    // config at Base Sepolia (84532) or a local anvil node (31337).
    base: {
      id: chainId,
      rpc: process.env.PONDER_RPC_URL ?? "https://mainnet.base.org",
      // anvil is wiped on every restart, so its RPC responses must not be cached.
      disableCache: chainId === 31337,
    },
  },
  contracts: {
    Streak: {
      chain: "base",
      abi: streakAbi,
      address: (process.env.STREAK_ADDRESS ??
        "0x0000000000000000000000000000000000000000") as `0x${string}`,
      // The deployment block. Ponder backfills every CheckedIn log from here to the
      // chain tip, then follows new blocks — so the API always covers the contract's
      // entire history, not just what happened while a page was open.
      startBlock: Number(process.env.STREAK_START_BLOCK ?? 0),
    },
  },
});
