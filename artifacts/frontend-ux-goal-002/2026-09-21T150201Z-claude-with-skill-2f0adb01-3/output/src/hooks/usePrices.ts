import { useReadContracts } from "wagmi";
import {
  CHAIN,
  ETH_USD_FEED,
  ETH_USD_MAX_AGE_S,
  USDC_USD_FEED,
  USDC_USD_MAX_AGE_S,
  aggregatorAbi,
} from "@/lib/contracts";

type RoundData = readonly [bigint, bigint, bigint, bigint, bigint];

function freshPrice(round: RoundData | undefined, maxAgeS: number): bigint | undefined {
  if (!round) return undefined;
  const [, answer, , updatedAt] = round;
  const ageS = Date.now() / 1000 - Number(updatedAt);
  if (answer <= 0n || ageS > maxAgeS) return undefined;
  return answer;
}

/** ETH/USD and USDC/USD from Chainlink (8 decimals). Undefined when unavailable or stale. */
export function usePrices() {
  const { data } = useReadContracts({
    contracts: [
      { chainId: CHAIN.id, address: ETH_USD_FEED, abi: aggregatorAbi, functionName: "latestRoundData" },
      { chainId: CHAIN.id, address: USDC_USD_FEED, abi: aggregatorAbi, functionName: "latestRoundData" },
    ],
    query: { refetchInterval: 60_000 },
  });

  return {
    ethUsd: freshPrice(data?.[0]?.result, ETH_USD_MAX_AGE_S),
    usdcUsd: freshPrice(data?.[1]?.result, USDC_USD_MAX_AGE_S),
  };
}
