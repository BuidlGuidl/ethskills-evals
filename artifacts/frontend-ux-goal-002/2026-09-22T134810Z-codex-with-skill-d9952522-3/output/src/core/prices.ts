type PriceResponse = {
  ethereum?: { usd?: number };
  "usd-coin"?: { usd?: number };
};

export type TokenPrices = {
  ethUsd?: number;
  usdcUsd?: number;
  updatedAt?: Date;
};

export async function fetchTokenPrices(): Promise<TokenPrices> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=usd",
    { headers: { accept: "application/json" } },
  );

  if (!response.ok) {
    throw new Error("Could not load price data.");
  }

  const data = (await response.json()) as PriceResponse;

  return {
    ethUsd: data.ethereum?.usd,
    usdcUsd: data["usd-coin"]?.usd,
    updatedAt: new Date(),
  };
}
