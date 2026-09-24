import { useQuery } from "@tanstack/react-query";

type CoinGeckoResponse = {
  ethereum?: {
    usd?: number;
  };
};

export function useEthUsdPrice() {
  return useQuery({
    queryKey: ["eth-usd-price"],
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      );

      if (!response.ok) {
        throw new Error("Could not load ETH price.");
      }

      const data = (await response.json()) as CoinGeckoResponse;
      const price = data.ethereum?.usd;

      if (!price || !Number.isFinite(price)) {
        throw new Error("ETH price was not available.");
      }

      return price;
    },
  });
}
