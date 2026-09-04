import { createConfig } from "ponder";
import { streakAbi } from "./abis/streakAbi";

/**
 * The indexer backfills the contract's entire history once (from `startBlock`,
 * the deploy block) into Postgres, then tails new blocks. Nothing in the app
 * ever scans logs at request time.
 */
export default createConfig({
  ordering: "omnichain",
  database: process.env.DATABASE_URL
    ? { kind: "postgres", connectionString: process.env.DATABASE_URL }
    : { kind: "pglite" },
  chains: {
    base: {
      id: Number(process.env.CHAIN_ID ?? 8453),
      // A paid/dedicated RPC is strongly recommended for the initial backfill.
      rpc: process.env.PONDER_RPC_URL_BASE,
    },
  },
  contracts: {
    Streak: {
      chain: "base",
      abi: streakAbi,
      address: process.env.STREAK_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.STREAK_START_BLOCK ?? 0),
    },
  },
});
