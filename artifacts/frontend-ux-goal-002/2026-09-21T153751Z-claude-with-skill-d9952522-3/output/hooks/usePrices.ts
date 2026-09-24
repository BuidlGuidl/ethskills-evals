import { useReadContracts } from "wagmi";
import { chainlinkAbi, FEEDS } from "@/lib/tokens";
import { TARGET_CHAIN } from "@/lib/wagmi";

export type Price =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ok"; price: bigint; stale: boolean; updatedAt: number };

const feeds = [FEEDS.ethUsd, FEEDS.usdcUsd] as const;

// Onchain Chainlink prices; flagged stale when older than the feed's heartbeat (+10 min grace).
export function usePrices(): { ethUsd: Price; usdcUsd: Price } {
  const { data, isLoading } = useReadContracts({
    contracts: feeds.map((f) => ({
      address: f.address,
      abi: chainlinkAbi,
      functionName: "latestRoundData",
      chainId: TARGET_CHAIN.id,
    })),
    query: { refetchInterval: 60_000 },
  });

  const toPrice = (i: number): Price => {
    if (isLoading) return { status: "loading" };
    const r = data?.[i];
    if (!r || r.status !== "success") return { status: "unavailable" };
    const [, answer, , updatedAt] = r.result;
    if (answer <= 0n) return { status: "unavailable" };
    const age = Date.now() / 1000 - Number(updatedAt);
    return { status: "ok", price: answer, stale: age > feeds[i].heartbeat + 600, updatedAt: Number(updatedAt) };
  };

  return { ethUsd: toPrice(0), usdcUsd: toPrice(1) };
}
