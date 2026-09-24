import { useQuery } from "@tanstack/react-query";

type CoinbaseSpotResponse = {
  data?: {
    amount?: string;
  };
};

export function useEthPrice() {
  return useQuery({
    queryKey: ["eth-usd-spot"],
    queryFn: async () => {
      const response = await fetch(
        "https://api.coinbase.com/v2/prices/ETH-USD/spot",
      );

      if (!response.ok) {
        throw new Error("Unable to fetch ETH price");
      }

      const payload = (await response.json()) as CoinbaseSpotResponse;
      const amount = Number(payload.data?.amount);

      if (!Number.isFinite(amount)) {
        throw new Error("ETH price response was invalid");
      }

      return amount;
    },
    staleTime: 60_000,
    retry: 1,
  });
}
