import { useEffect, useMemo, useState } from "react";

type PricePayload = {
  ethereum?: { usd?: number };
  "usd-coin"?: { usd?: number };
};

type PriceState = {
  ethUsd?: number;
  usdcUsd?: number;
  updatedAt?: number;
  error?: string;
  isLoading: boolean;
};

const PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=usd";
const STALE_AFTER_MS = 5 * 60 * 1000;
const REFRESH_MS = 60 * 1000;

export function useCryptoPrices() {
  const [state, setState] = useState<PriceState>({ isLoading: true });

  useEffect(() => {
    let cancelled = false;

    async function fetchPrices() {
      try {
        const response = await fetch(PRICE_URL, {
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Price feed returned ${response.status}`);
        }

        const payload = (await response.json()) as PricePayload;
        const ethUsd = payload.ethereum?.usd;
        const usdcUsd = payload["usd-coin"]?.usd;

        if (typeof ethUsd !== "number" || typeof usdcUsd !== "number") {
          throw new Error("Price feed response was missing ETH or USDC.");
        }

        if (!cancelled) {
          setState({
            ethUsd,
            usdcUsd,
            updatedAt: Date.now(),
            isLoading: false,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            error:
              error instanceof Error
                ? error.message
                : "Price feed is unavailable.",
            isLoading: false,
          }));
        }
      }
    }

    fetchPrices();
    const interval = window.setInterval(fetchPrices, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return useMemo(
    () => ({
      ...state,
      isStale:
        !state.updatedAt || Date.now() - state.updatedAt > STALE_AFTER_MS,
    }),
    [state],
  );
}

