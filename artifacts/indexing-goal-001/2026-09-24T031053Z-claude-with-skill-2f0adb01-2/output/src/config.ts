/**
 * Read-side configuration.
 *
 * The subgraph URL is the only thing the three screens strictly need. The RPC
 * URL is optional: it powers the live tail on the feed and the onchain fallback
 * for a profile (see src/profile.ts).
 */
export interface StreakConfig {
  /** GraphQL endpoint of the deployed Streak subgraph. */
  subgraphUrl: string;
  /** Optional Base RPC (https for reads, wss for the live tail). */
  rpcUrl?: string;
  /** Deployed Streak contract address, needed only for direct RPC reads. */
  contractAddress?: `0x${string}`;
}

export function configFromEnv(env: Record<string, string | undefined> = process.env): StreakConfig {
  const subgraphUrl = env.STREAK_SUBGRAPH_URL;
  if (!subgraphUrl) {
    throw new Error("STREAK_SUBGRAPH_URL is not set (see .env.example)");
  }
  return {
    subgraphUrl,
    rpcUrl: env.BASE_RPC_URL,
    contractAddress: env.STREAK_ADDRESS as `0x${string}` | undefined,
  };
}
