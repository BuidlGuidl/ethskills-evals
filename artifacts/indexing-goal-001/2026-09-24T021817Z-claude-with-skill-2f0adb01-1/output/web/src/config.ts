/** Server-only config. Throws loudly at first use rather than silently querying nothing. */
export function subgraphUrl(): string {
  const url = process.env.SUBGRAPH_URL;
  if (!url) {
    throw new Error(
      "SUBGRAPH_URL is not set. Copy web/.env.example to web/.env.local and point " +
        "it at your graph-node, Subgraph Studio, or gateway URL."
    );
  }
  return url;
}

/** Public config, safe to ship to the browser (used by the check-in button). */
export const streakAddress = (process.env.NEXT_PUBLIC_STREAK_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 8453);
