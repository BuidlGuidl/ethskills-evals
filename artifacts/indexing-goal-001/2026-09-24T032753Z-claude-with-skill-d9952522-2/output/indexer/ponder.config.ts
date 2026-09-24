import { createConfig } from "ponder";
import { StreakAbi } from "./abis/StreakAbi";

if (!process.env.STREAK_ADDRESS) throw new Error("STREAK_ADDRESS is not set");
if (!process.env.STREAK_START_BLOCK) throw new Error("STREAK_START_BLOCK is not set");

// Defaults to Base mainnet. Local development points the same config at an Anvil
// node (CHAIN_ID=31337) so the whole read side can be exercised without a testnet.
const chainId = Number(process.env.CHAIN_ID ?? 8453);
const isLocal = chainId === 31337;

export default createConfig({
  chains: {
    base: {
      id: chainId,
      rpc: process.env.PONDER_RPC_URL_8453,
      // Anvil block hashes change on every restart, so the on-disk RPC cache must
      // not be reused across local runs.
      disableCache: isLocal,
    },
  },
  contracts: {
    Streak: {
      chain: "base",
      abi: StreakAbi,
      address: process.env.STREAK_ADDRESS as `0x${string}`,
      // The deployment block. Ponder backfills from here to the chain head once,
      // persists the result, then tails new blocks. Never "latest" — that would
      // silently drop every check-in that happened before the process started.
      startBlock: Number(process.env.STREAK_START_BLOCK),
    },
  },
});
