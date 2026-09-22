import { useQuery } from "@tanstack/react-query";

type PriceResponse = {
  ethereum?: {
    usd?: number;
    last_updated_at?: number;
  };
  "usd-coin"?: {
    usd?: number;
    last_updated_at?: number;
  };
};

export function useTokenPrices() {
  return useQuery({
    queryKey: ["prices", "coingecko", "ethereum", "usd-coin"],
    queryFn: async () => {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=usd&include_last_updated_at=true",
      );

      if (!response.ok) {
        throw new Error("Price source unavailable.");
      }

      const data = (await response.json()) as PriceResponse;

      return {
        ethUsd: data.ethereum?.usd,
        ethUpdatedAt: data.ethereum?.last_updated_at,
        usdcUsd: data["usd-coin"]?.usd,
        usdcUpdatedAt: data["usd-coin"]?.last_updated_at,
      };
    },
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 60_000,
  });
}
