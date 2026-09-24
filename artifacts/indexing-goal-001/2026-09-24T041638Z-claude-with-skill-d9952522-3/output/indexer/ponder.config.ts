import { createConfig } from "ponder";
import { StreakAbi } from "./abis/StreakAbi";

/**
 * Base mainnet is the real deployment. `STREAK_CHAIN=anvil` points the same
 * indexer at a local node, which is how you develop handlers and API routes
 * without waiting on a months-long mainnet backfill.
 */
const CHAINS = {
  base: { id: 8453, rpcEnv: "PONDER_RPC_URL_8453" },
  anvil: { id: 31337, rpcEnv: "PONDER_RPC_URL_31337", disableCache: true },
} as const;

const name = (process.env.STREAK_CHAIN ?? "base") as keyof typeof CHAINS;
const chain = CHAINS[name];
if (chain === undefined) {
  throw new Error(`STREAK_CHAIN must be one of: ${Object.keys(CHAINS).join(", ")}`);
}

const rpc = process.env[chain.rpcEnv];
if (!rpc) throw new Error(`${chain.rpcEnv} is required for STREAK_CHAIN=${name}`);

const address = process.env.STREAK_ADDRESS;
if (!address?.startsWith("0x")) {
  throw new Error("STREAK_ADDRESS must be the deployed Streak contract address");
}

const startBlock = Number(process.env.STREAK_START_BLOCK);
if (!Number.isFinite(startBlock)) {
  throw new Error(
    "STREAK_START_BLOCK must be the block the Streak contract was deployed in. " +
      "Starting later silently drops history; starting at 0 wastes hours of backfill.",
  );
}

export default createConfig({
  // Local dev uses PGlite (no setup). In production PONDER_DATABASE_URL points at
  // Postgres, which is what makes the backfill a one-time cost instead of a
  // re-scan on every restart.
  database: process.env.PONDER_DATABASE_URL
    ? { kind: "postgres", connectionString: process.env.PONDER_DATABASE_URL }
    : { kind: "pglite" },
  chains: {
    [name]: {
      id: chain.id,
      rpc,
      ...("disableCache" in chain ? { disableCache: chain.disableCache } : {}),
    },
  },
  contracts: {
    Streak: {
      chain: name,
      abi: StreakAbi,
      address: address as `0x${string}`,
      startBlock,
    },
  },
});
